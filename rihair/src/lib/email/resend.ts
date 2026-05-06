import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "orders@rihaircollectables.com";
const BRAND_FROM = `RI Hair Collectables <${FROM}>`;

// ─── Order Confirmation ──────────────────────────────────────────────────────

interface OrderConfirmationParams {
  to: string;
  firstName: string;
  orderNumber: string;
  orderTotal: string;
  items: { name: string; quantity: number; price: string }[];
  shippingAddress: string;
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationParams) {
  const { to, firstName, orderNumber, orderTotal, items, shippingAddress } = params;

  const itemRows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">${item.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center;">×${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${item.price}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: BRAND_FROM,
    to,
    subject: `Order Confirmed — #${orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#FAFAF8;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#0A0A0A;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:40px 20px;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
              <!-- Header -->
              <tr>
                <td style="background:#0A0A0A;padding:32px 40px;text-align:center;">
                  <p style="margin:0;font-family:Georgia,serif;font-size:28px;color:#C9A84C;font-weight:600;letter-spacing:.05em;">RI Hair Collectables</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;font-weight:600;color:#0A0A0A;">Order Confirmed!</h1>
                  <p style="margin:0 0 24px;color:#666;font-size:15px;">Hi ${firstName}, thank you for your order. We're getting it ready.</p>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="background:#FAFAF8;border-radius:10px;padding:16px 20px;">
                        <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Order Number</p>
                        <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#0A0A0A;">#${orderNumber}</p>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <thead>
                      <tr>
                        <th style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#999;padding-bottom:8px;">Item</th>
                        <th style="text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#999;padding-bottom:8px;">Qty</th>
                        <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#999;padding-bottom:8px;">Price</th>
                      </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot>
                      <tr>
                        <td colspan="2" style="padding-top:12px;font-weight:600;font-size:15px;">Total</td>
                        <td style="padding-top:12px;font-weight:700;font-size:15px;text-align:right;color:#C9A84C;">${orderTotal}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <p style="font-size:13px;color:#666;margin:0 0 6px;"><strong>Shipping to:</strong></p>
                  <p style="font-size:13px;color:#666;margin:0 0 28px;white-space:pre-line;">${shippingAddress}</p>

                  <a href="${process.env.NEXTAUTH_URL}/dashboard/orders" style="display:inline-block;background:#0A0A0A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">View My Order</a>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#FAFAF8;padding:24px 40px;text-align:center;border-top:1px solid #f0f0f0;">
                  <p style="margin:0;font-size:12px;color:#999;">Questions? Reply to this email or WhatsApp us at ${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}</p>
                  <p style="margin:8px 0 0;font-size:12px;color:#ccc;">RI Hair Collectables · Lagos, Nigeria</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
}

// ─── Booking Confirmation ────────────────────────────────────────────────────

interface BookingConfirmationParams {
  to: string;
  firstName: string;
  service: string;
  date: string;
  time: string;
  price: string;
}

export async function sendBookingConfirmationEmail(params: BookingConfirmationParams) {
  const { to, firstName, service, date, time, price } = params;

  await resend.emails.send({
    from: BRAND_FROM,
    to,
    subject: `Booking Confirmed — ${service}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:40px 20px;background:#FAFAF8;font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
          <tr><td style="background:#0A0A0A;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:Georgia,serif;font-size:28px;color:#C9A84C;font-weight:600;">RI Hair Collectables</p>
          </td></tr>
          <tr><td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;color:#0A0A0A;">Appointment Confirmed</h1>
            <p style="margin:0 0 28px;color:#666;">Hi ${firstName}, your appointment is booked. See you soon!</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;border-radius:10px;padding:20px;margin-bottom:28px;">
              <tr><td style="padding:6px 0;"><strong style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#999;">Service</strong><br><span style="font-size:16px;font-weight:600;">${service}</span></td></tr>
              <tr><td style="padding:6px 0;border-top:1px solid #eee;"><strong style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#999;">Date & Time</strong><br><span style="font-size:16px;font-weight:600;">${date} at ${time}</span></td></tr>
              <tr><td style="padding:6px 0;border-top:1px solid #eee;"><strong style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#999;">Price</strong><br><span style="font-size:16px;font-weight:600;color:#C9A84C;">${price}</span></td></tr>
            </table>
            <p style="font-size:13px;color:#666;margin:0 0 4px;">📍 Lagos, Nigeria (address confirmed via WhatsApp)</p>
            <p style="font-size:13px;color:#666;margin:0 0 28px;">Need to reschedule? Contact us at least 24 hours before your appointment.</p>
            <a href="https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "")}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">WhatsApp Us</a>
          </td></tr>
          <tr><td style="background:#FAFAF8;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#ccc;">RI Hair Collectables · Lagos, Nigeria</p>
          </td></tr>
        </table>
        </td></tr></table>
      </body>
      </html>
    `,
  });
}

// ─── Password Reset ──────────────────────────────────────────────────────────

interface PasswordResetParams {
  to: string;
  firstName: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(params: PasswordResetParams) {
  const { to, firstName, resetUrl } = params;

  await resend.emails.send({
    from: BRAND_FROM,
    to,
    subject: "Reset your RI Hair password",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:40px 20px;background:#FAFAF8;font-family:Helvetica,Arial,sans-serif;color:#0A0A0A;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
          <tr><td style="background:#0A0A0A;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-family:Georgia,serif;font-size:24px;color:#C9A84C;font-weight:600;">RI Hair Collectables</p>
          </td></tr>
          <tr><td style="padding:40px;text-align:center;">
            <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#0A0A0A;">Reset your password</h1>
            <p style="margin:0 0 28px;color:#666;font-size:14px;">Hi ${firstName}, click below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#0A0A0A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:24px;">Reset Password</a>
            <p style="font-size:12px;color:#999;margin:0;">If you didn't request this, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="background:#FAFAF8;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:11px;color:#ccc;">RI Hair Collectables · Lagos, Nigeria</p>
          </td></tr>
        </table>
        </td></tr></table>
      </body>
      </html>
    `,
  });
}

// ─── Contact Form ────────────────────────────────────────────────────────────

interface ContactEmailParams {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(params: ContactEmailParams) {
  await resend.emails.send({
    from: BRAND_FROM,
    to: process.env.RESEND_FROM_EMAIL ?? FROM,
    replyTo: params.email,
    subject: `[Contact Form] ${params.subject}`,
    html: `
      <p><strong>From:</strong> ${params.name} &lt;${params.email}&gt;</p>
      <p><strong>Subject:</strong> ${params.subject}</p>
      <hr>
      <p>${params.message.replace(/\n/g, "<br>")}</p>
    `,
  });
}
