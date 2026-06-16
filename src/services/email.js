import Mailgun from "mailgun.js";
import FormData from "form-data";

class EmailService {
  constructor() {
    this.client = null;
    this.domain = process.env.MAILGUN_DOMAIN || "";
    this.from = process.env.EMAIL_FROM || "LR Parts <noreply@lrparts.ie>";
  }

  getClient() {
    if (this.client) return this.client;

    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) return null;

    const mailgun = new Mailgun(FormData);
    this.client = mailgun.client({
      username: "api",
      key: apiKey,
      url: process.env.MAILGUN_API_URL || "https://api.mailgun.net",
    });

    return this.client;
  }

  async send(to, subject, html) {
    const client = this.getClient();

    if (!client) {
      console.log(`[Email] Would send to ${to}: ${subject}`);
      return;
    }

    try {
      await client.messages.create(this.domain, {
        from: this.from,
        to: [to],
        subject,
        html,
      });
    } catch (err) {
      console.error(`[Email] Mailgun send failed to ${to}:`, err.message);
      throw err;
    }
  }
}

export default new EmailService();
