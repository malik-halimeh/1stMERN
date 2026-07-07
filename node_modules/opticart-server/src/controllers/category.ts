import { Request, Response, NextFunction } from 'express';
import Category from '../models/Category.js';
import { AppError } from '../utils/errors.js';
import mongoose from 'mongoose';

// 1. GET /api/categories - Public, returns full 2-level tree
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allCategories = await Category.find().sort({ name: 1 });
    
    // Root categories have parentId = null
    const rootCategories = allCategories.filter((cat) => !cat.parentId);
    
    // Subcategories have parentId defined
    const categoryTree = rootCategories.map((root) => {
      const subcategories = allCategories.filter(
        (sub) => sub.parentId?.toString() === root._id.toString()
      );
      return {
        _id: root._id,
        name: root.name,
        slug: root.slug,
        createdAt: root.createdAt,
        subcategories: subcategories.map((sub) => ({
          _id: sub._id,
          name: sub.name,
          slug: sub.slug,
          createdAt: sub.createdAt,
        })),
      };
    });

    res.status(200).json({
      success: true,
      data: categoryTree,
    });
  } catch (error) {
    next(error);
  }
};

// 2. POST /api/categories - Inventory Manager Only
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, parentId } = req.body;

    if (!name) {
      throw new AppError('VALIDATION_FAILED', 'Category name is required.', 422);
    }

    // Verify parent category if parentId is provided
    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        throw new AppError('VALIDATION_FAILED', 'Invalid parentId format.', 422);
      }
      const parent = await Category.findById(parentId);
      if (!parent) {
        throw new AppError('PARENT_NOT_FOUND', 'Parent category does not exist.', 404);
      }
    }

    const category = await Category.create({
      name,
      slug,
      parentId: parentId || null,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// 3. PATCH /api/categories/:id - Inventory Manager Only
export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, slug, parentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid category ID format.', 422);
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found.', 404);
    }

    if (name) category.name = name;
    if (slug) category.slug = slug;
    
    if (parentId !== undefined) {
      if (parentId) {
        if (!mongoose.Types.ObjectId.isValid(parentId)) {
          throw new AppError('VALIDATION_FAILED', 'Invalid parentId format.', 422);
        }
        if (parentId === id) {
          throw new AppError('VALIDATION_FAILED', 'A category cannot be its own parent.', 422);
        }
        const parent = await Category.findById(parentId);
        if (!parent) {
          throw new AppError('PARENT_NOT_FOUND', 'Parent category does not exist.', 404);
        }
        category.parentId = new mongoose.Types.ObjectId(parentId);
      } else {
        category.parentId = null;
      }
    }

    await category.save();

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// 4. DELETE /api/categories/:id - Inventory Manager Only
export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid category ID format.', 422);
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found.', 404);
    }

    // Check if subcategories exist referencing this category
    const hasSubs = await Category.findOne({ parentId: id });
    if (hasSubs) {
      throw new AppError(
        'CATEGORY_HAS_SUBCATEGORIES',
        'Cannot delete category containing active subcategories. Delete subcategories first.',
        409
      );
    }

    await Category.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      data: {
        message: 'Category deleted successfully.',
      },
    });
  } catch (error) {
    next(error);
  }
};
