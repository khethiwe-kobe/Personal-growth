import { getDb, getSetting } from "./db";

/**
 * Communication automation. Messages are rendered from templates and queued
 * in `communications`. Channel adapters are deliberately thin so WhatsApp
 * Business, an email provider or an SMS gateway can be plugged in later.
 */
export type TemplateKey =
  | "welcome" | "assessment_received" | "meal_plan_ready" | "payment_reminder" | "order_confirmation"
  | "preparation_started" | "delivery_reminder" | "delivered" | "feedback_request" | "subscription_renewal";

export const TEMPLATES: Record<TemplateKey, { subject: string; body: string; channel: "whatsapp" | "email" | "sms" }> = {
  welcome: { channel: "whatsapp", subject: "Welcome to {{brand}}", body: "Hi {{first_name}}, welcome to {{brand}}! We've received your profile and will be in touch with your personalised nutrition summary shortly." },
  assessment_received: { channel: "email", subject: "Your assessment has been received", body: "Hi {{first_name}}, thank you for completing your assessment. Our team is reviewing it and will prepare your meal recommendations." },
  meal_plan_ready: { channel: "whatsapp", subject: "Your meal plan is ready", body: "Hi {{first_name}}, your meal plan for the week of {{week}} is ready. Log in to your portal to review and approve it." },
  payment_reminder: { channel: "whatsapp", subject: "Payment reminder", body: "Hi {{first_name}}, a friendly reminder that order {{order}} (R{{total}}) is awaiting payment so we can schedule your meals." },
  order_confirmation: { channel: "email", subject: "Order {{order}} confirmed", body: "Hi {{first_name}}, your order {{order}} totalling R{{total}} is confirmed. We'll let you know when preparation starts." },
  preparation_started: { channel: "whatsapp", subject: "Your meals are being prepared", body: "Hi {{first_name}}, our kitchen has started preparing your meals." },
  delivery_reminder: { channel: "whatsapp", subject: "Delivery tomorrow", body: "Hi {{first_name}}, your meals will be delivered on {{date}} between {{window}}." },
  delivered: { channel: "whatsapp", subject: "Delivered", body: "Hi {{first_name}}, your meals have been delivered. Keep them refrigerated and enjoy!" },
  feedback_request: { channel: "whatsapp", subject: "How were your meals?", body: "Hi {{first_name}}, we'd love your feedback on order {{order}}. It takes 30 seconds in your portal." },
  subscription_renewal: { channel: "email", subject: "Your subscription renews soon", body: "Hi {{first_name}}, your subscription renews on {{date}}. Reply to skip a week, pause, or change your package." },
};

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export function queueMessage(clientId: number, key: TemplateKey, vars: Record<string, string> = {}): number | null {
  const db = getDb();
  const c = db.prepare("SELECT first_name, email, phone FROM clients WHERE id = ?").get(clientId) as { first_name: string; email: string; phone: string } | undefined;
  if (!c) return null;
  const t = TEMPLATES[key];
  const all = { brand: getSetting("brand_name"), first_name: c.first_name, ...vars };
  const r = db.prepare("INSERT INTO communications (client_id, channel, template, subject, body, status) VALUES (?, ?, ?, ?, ?, 'queued')")
    .run(clientId, t.channel, key, render(t.subject, all), render(t.body, all));
  return Number(r.lastInsertRowid);
}

/** Channel adapters. Replace the bodies with real provider calls. */
export const ADAPTERS: Record<"whatsapp" | "email" | "sms", (to: string, subject: string, body: string) => Promise<{ ok: boolean; ref: string }>> = {
  whatsapp: async () => ({ ok: false, ref: "not-configured" }),
  email: async () => ({ ok: false, ref: "not-configured" }),
  sms: async () => ({ ok: false, ref: "not-configured" }),
};

export function listQueued(limit = 200) {
  return getDb().prepare(
    `SELECT m.*, c.first_name, c.last_name FROM communications m LEFT JOIN clients c ON c.id = m.client_id ORDER BY m.id DESC LIMIT ?`
  ).all(limit) as { id: number; client_id: number; channel: string; template: string; subject: string; body: string; status: string; created_at: string; sent_at: string | null; first_name: string; last_name: string }[];
}

export function markSent(id: number, status: "sent" | "failed" | "skipped", ref = "") {
  getDb().prepare("UPDATE communications SET status = ?, provider_ref = ?, sent_at = datetime('now') WHERE id = ?").run(status, ref, id);
}

export const INTEGRATION_POINTS = [
  { name: "WhatsApp Business", how: "Implement ADAPTERS.whatsapp with the Cloud API; messages are already queued with rendered bodies." },
  { name: "Email (Mailchimp / Transactional)", how: "Implement ADAPTERS.email; Mailchimp audience sync can subscribe to the 'client.created' webhook event." },
  { name: "SMS", how: "Implement ADAPTERS.sms (e.g. Clickatell, Twilio)." },
  { name: "Make.com / Zapier / n8n", how: "Set MEALPREP_WEBHOOK_URL; every automation event is POSTed as JSON." },
  { name: "Google Sheets", how: "Use the webhook stream or the CSV exports under /api/export/*." },
  { name: "Xero", how: "Export payments & expenses as CSV (/api/export/payments, /api/export/expenses) or map the 'payment.received' event." },
  { name: "PayFast / Stripe", how: "Point the gateway webhook at an API route that calls recordPayment(); the 'payment.received' event drives production." },
  { name: "Google Calendar", how: "Subscribe to 'delivery.scheduled' events to create calendar entries for drivers." },
];
