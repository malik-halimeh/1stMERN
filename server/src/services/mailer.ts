import nodemailer from 'nodemailer';
import User from '../models/User.js';

// ─── Transport ────────────────────────────────────────────────────────────────
// Real emails are sent when SMTP credentials exist in .env:
//   GMAIL_USER + GMAIL_APP_PASSWORD  (Gmail app password — easiest), or
//   SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS (any provider)
// Without credentials every message is logged to the console (dev stub).

// Lazily built on first send: dotenv.config() runs AFTER module imports are
// hoisted, so reading process.env at import time would miss .env values.
let transporter: nodemailer.Transporter | null | undefined;

const getTransporter = (): nodemailer.Transporter | null => {
  if (transporter !== undefined) return transporter;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST;

  // Hosts like Render have no outbound IPv6 route, yet Node resolves SMTP
  // hosts to an AAAA record first — the connection then hangs until it fails
  // with ENETUNREACH (~2 min). Force IPv4 and cap every stage with a short
  // timeout so a failed send falls back to the console stub in seconds.
  const netOpts = {
    family: 4 as const,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };

  transporter =
    gmailUser && gmailPass
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
          ...netOpts,
        })
      : smtpHost
        ? nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465',
            auth: process.env.SMTP_USER
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
            ...netOpts,
          })
        : null;
  return transporter;
};

/** Send via SMTP when configured; otherwise log to console (dev stub). */
const deliver = async (to: string, subject: string, body: string) => {
  const transport = getTransporter();
  if (transport) {
    const from = process.env.MAIL_FROM || process.env.GMAIL_USER || 'OptiCart <no-reply@opticart.dev>';
    try {
      await transport.sendMail({ from, to, subject, text: body });
      console.log(`✉️  Mail sent to ${to}: ${subject}`);
      return;
    } catch (err: any) {
      console.error(`✉️  SMTP send failed (${err.message}) — falling back to console log.`);
    }
  }
  console.log('========================================================================');
  console.log(`✉️  EMAIL DISPATCHED (console stub)`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
  console.log('========================================================================');
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const sendVerificationCodeEmail = (email: string, code: string) => {
  return deliver(
    email,
    'Your OptiCart verification code',
    `Welcome to OptiCart!\n\nYour email verification code is: ${code}\n\nIt expires in 15 minutes. If you did not create an account, you can ignore this email.`
  );
};

export const sendPasswordResetCodeEmail = (email: string, code: string) => {
  return deliver(
    email,
    'Your OptiCart password reset code',
    `We received a request to reset your OptiCart password.\n\nYour password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request a password reset, you can safely ignore this email — your password will not change.`
  );
};

export const sendOrderConfirmationEmail =(email: string, orderNumber: string, totalAmount: number) => {
  return deliver(
    email,
    `We received your OptiCart order - ${orderNumber}`,
    `Thank you for shopping with OptiCart! Total Paid: $${(totalAmount / 100).toFixed(2)}.\n\nYour order is being reviewed by our team — you will get another update as soon as it is confirmed.`
  );
};

export const sendOrderStatusChangeEmail = (
  email: string,
  orderNumber: string,
  status: string,
  reason?: string
) => {
  const reasonLine = reason ? `\n\nReason: ${reason}` : '';
  return deliver(
    email,
    `Your OptiCart order status has changed: ${status.toUpperCase()} - ${orderNumber}`,
    `Your order is now marked as ${status}.${reasonLine}\n\nYou can trace tracking details in your profile.`
  );
};

export const sendLowStockAlertEmail = async (sku: string, currentStock: number) => {
  try {
    // Notify all inventory managers
    const managers = await User.find({ role: 'inventory_manager', isActive: true });
    const emails = managers.map((m) => m.email);

    if (emails.length === 0) {
      console.log(`⚠️  Mailer: No active inventory managers found to notify for low stock warning on SKU ${sku}.`);
      return;
    }

    await deliver(
      emails.join(', '),
      `WARNING: Low Stock Triggered on SKU ${sku}`,
      `Variant SKU "${sku}" stock level has dropped to ${currentStock}. Please issue restocks.`
    );
  } catch (err: any) {
    console.error('Failed to dispatch low stock emails:', err.message);
  }
};
