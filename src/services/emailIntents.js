/**
 * Centralized notification intent map.
 * Each intent defines: who to send to, subject, and HTML body.
 * All templates use a shared branded layout wrapper.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ─── Shared layout wrapper ───

function wrapInLayout(bodyHtml) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1B3C28;padding:24px;text-align:center">
        <h1 style="color:white;margin:0;font-size:24px">LR Parts Ireland</h1>
      </div>
      <div style="padding:24px">
        ${bodyHtml}
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;color:#999;font-size:12px">
        &copy; ${new Date().getFullYear()} LR Parts Ireland &mdash; Premium Land Rover Parts
      </div>
    </div>
  `;
}

function button(href, text) {
  return `<p style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;background:#1B3C28;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">${text}</a></p>`;
}

// ─── Intent definitions ───

export const INTENTS = {
  // ──────────────── Auth ────────────────

  VERIFICATION_EMAIL: (data) => ({
    to: data.user.email,
    subject: "Verify your email - LR Parts",
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Verify your email</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Thanks for signing up! Please verify your email address to get started:</p>
      ${button(`${FRONTEND_URL}/verify-email?token=${data.verificationToken}`, "Verify Email")}
      <p style="color:#666;font-size:14px">If the button doesn't work, copy and paste this link:</p>
      <p style="color:#666;font-size:12px;word-break:break-all">${FRONTEND_URL}/verify-email?token=${data.verificationToken}</p>
    `),
  }),

  WELCOME: (data) => ({
    to: data.user.email,
    subject: "Welcome to LR Parts Ireland!",
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Welcome to LR Parts!</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Your account is all set. You can now:</p>
      <ul>
        <li>Save vehicles to your garage</li>
        <li>Track your orders</li>
        <li>Get faster checkout</li>
      </ul>
      ${button(`${FRONTEND_URL}/products`, "Browse Parts")}
    `),
  }),

  PASSWORD_RESET: (data) => ({
    to: data.user.email,
    subject: "Password Reset - LR Parts",
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Password Reset</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      ${button(`${FRONTEND_URL}/forgot-password?token=${data.resetToken}`, "Reset Password")}
      <p style="color:#666;font-size:14px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `),
  }),

  PASSWORD_CHANGED: (data) => ({
    to: data.user.email,
    subject: "Password Changed - LR Parts",
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Password Changed</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Your password has been successfully changed.</p>
      <p style="color:#666;font-size:14px">If you didn't make this change, please contact us immediately at <a href="mailto:info@lrparts.ie">info@lrparts.ie</a>.</p>
    `),
  }),

  // ──────────────── Orders ────────────────

  CONTACT_RECEIVED: (data) => ({
    to: process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] || "info@lrparts.ie",
    subject: `New Contact: ${data.subject}`,
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">New Contact Message</h2>
      <p><strong>From:</strong> ${data.name} (${data.email})</p>
      <p><strong>Subject:</strong> ${data.subject}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
      <p style="white-space:pre-wrap">${data.message}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
      <p style="color:#666;font-size:12px">Reply directly to ${data.email}</p>
    `),
  }),

  ORDER_CONFIRMED: (data) => {
    const itemsHtml = (data.items || []).map((i) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">x${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">&euro;${Number(i.lineTotal).toFixed(2)}</td>
      </tr>`
    ).join("");

    return {
      to: data.user.email,
      subject: `Order Confirmed - ${data.order.orderNumber}`,
      html: wrapInLayout(`
        <h2 style="color:#1B3C28">Order Confirmed!</h2>
        <p>Hi ${data.user.firstName},</p>
        <p>Thank you for your order. Here are your details:</p>
        <p><strong>Order Number:</strong> ${data.order.orderNumber}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">Item</th>
              <th style="padding:8px;text-align:center">Qty</th>
              <th style="padding:8px;text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="font-size:18px;font-weight:bold;text-align:right">Total: &euro;${Number(data.order.total).toFixed(2)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#666;font-size:14px">Warehouse items ship same day (orders before 2pm). Supplier items arrive in 3-4 business days.</p>
        ${button(`${FRONTEND_URL}/account/orders`, "View Order")}
      `),
    };
  },

  ORDER_PROCESSING: (data) => ({
    to: data.user.email,
    subject: `Order Update - ${data.order.orderNumber}`,
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Your order is being prepared</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Your order <strong>${data.order.orderNumber}</strong> is now being processed and prepared for shipment.</p>
      <p style="color:#666;font-size:14px">We'll notify you again when it ships.</p>
      ${button(`${FRONTEND_URL}/account/orders`, "Track Order")}
    `),
  }),

  ORDER_SHIPPED: (data) => ({
    to: data.user.email,
    subject: `Order Shipped - ${data.order.orderNumber}`,
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Your order is on its way!</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Your order <strong>${data.order.orderNumber}</strong> has been shipped and is on its way to you.</p>
      <p style="color:#666;font-size:14px">You should receive it within the next 1-2 business days.</p>
      ${button(`${FRONTEND_URL}/account/orders`, "Track Order")}
    `),
  }),

  ORDER_DELIVERED: (data) => ({
    to: data.user.email,
    subject: `Order Delivered - ${data.order.orderNumber}`,
    html: wrapInLayout(`
      <h2 style="color:#1B3C28">Your order has been delivered</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Your order <strong>${data.order.orderNumber}</strong> has been delivered.</p>
      <p>We hope everything is in order. If you have any issues, don't hesitate to contact us.</p>
      ${button(`${FRONTEND_URL}/contact`, "Contact Support")}
    `),
  }),

  ORDER_CANCELLED: (data) => ({
    to: data.user.email,
    subject: `Order Cancelled - ${data.order.orderNumber}`,
    html: wrapInLayout(`
      <h2 style="color:#c0392b">Order Cancelled</h2>
      <p>Hi ${data.user.firstName},</p>
      <p>Your order <strong>${data.order.orderNumber}</strong> has been cancelled.</p>
      <p>If a payment was made, a refund will be processed within 5-10 business days.</p>
      <p style="color:#666;font-size:14px">If you didn't expect this, please contact us at <a href="mailto:info@lrparts.ie">info@lrparts.ie</a>.</p>
    `),
  }),
};
