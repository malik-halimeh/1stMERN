import { Request, Response, NextFunction } from 'express';
import Order from '../models/Order.js';
import User from '../models/User.js';

const parseWindow = (req: Request) => {
  const days = Math.min(365, Math.max(7, parseInt(req.query.days as string) || 30));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  return { days, since };
};

// Daily buckets by default; weekly for long windows (or explicit ?bucket=weekly)
const bucketStage = (req: Request, days: number, dateField = '$createdAt') => {
  const bucket =
    (req.query.bucket as string) === 'weekly' || days > 60 ? 'weekly' : 'daily';
  const _id =
    bucket === 'weekly'
      ? {
          $concat: [
            { $toString: { $isoWeekYear: dateField } },
            '-W',
            { $toString: { $isoWeek: dateField } },
          ],
        }
      : { $dateToString: { format: '%Y-%m-%d', date: dateField } };
  return { bucket, _id };
};

// 1. GET /api/analytics/revenue
// Revenue = sum(items[].unitPriceCents × quantity) over DELIVERED orders
export const getRevenue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days, since } = parseWindow(req);
    const { bucket, _id } = bucketStage(req, days);

    const series = await Order.aggregate([
      { $match: { status: 'delivered', createdAt: { $gte: since } } },
      { $unwind: '$items' },
      {
        $group: {
          _id,
          revenueCents: {
            $sum: { $multiply: ['$items.unitPriceCents', '$items.quantity'] },
          },
          orderIds: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          revenueCents: 1,
          orders: { $size: '$orderIds' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalRevenueCents = series.reduce((sum, p) => sum + p.revenueCents, 0);
    const deliveredOrders = series.reduce((sum, p) => sum + p.orders, 0);

    res.status(200).json({
      success: true,
      data: {
        windowDays: days,
        bucket,
        totalRevenueCents,
        deliveredOrders,
        avgOrderValueCents:
          deliveredOrders > 0 ? Math.round(totalRevenueCents / deliveredOrders) : 0,
        series: series.map((p) => ({
          period: p._id,
          revenueCents: p.revenueCents,
          orders: p.orders,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET /api/analytics/top-skus
// Most-purchased SKUs by quantity over delivered orders
export const getTopSkus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days, since } = parseWindow(req);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

    const skus = await Order.aggregate([
      { $match: { status: 'delivered', createdAt: { $gte: since } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.variantSku',
          productName: { $first: '$items.name' },
          units: { $sum: '$items.quantity' },
          revenueCents: {
            $sum: { $multiply: ['$items.unitPriceCents', '$items.quantity'] },
          },
        },
      },
      { $sort: { units: -1, revenueCents: -1 } },
      { $limit: limit },
    ]);

    res.status(200).json({
      success: true,
      data: {
        windowDays: days,
        skus: skus.map((s) => ({
          sku: s._id,
          productName: s.productName,
          units: s.units,
          revenueCents: s.revenueCents,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. GET /api/analytics/order-volume
// Order count over time (all statuses), daily/weekly buckets
export const getOrderVolume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days, since } = parseWindow(req);
    const { bucket, _id } = bucketStage(req, days);

    const series = await Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        windowDays: days,
        bucket,
        totalOrders: series.reduce((sum, p) => sum + p.orders, 0),
        series: series.map((p) => ({ period: p._id, orders: p.orders })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. GET /api/analytics/customer-growth
// New customer registrations over time
export const getCustomerGrowth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days, since } = parseWindow(req);
    const { bucket, _id } = bucketStage(req, days);

    const [series, totals] = await Promise.all([
      User.aggregate([
        { $match: { role: 'customer', createdAt: { $gte: since } } },
        { $group: { _id, customers: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ role: 'customer' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        windowDays: days,
        bucket,
        totalCustomers: totals,
        newCustomers: series.reduce((sum, p) => sum + p.customers, 0),
        series: series.map((p) => ({ period: p._id, customers: p.customers })),
      },
    });
  } catch (error) {
    next(error);
  }
};
