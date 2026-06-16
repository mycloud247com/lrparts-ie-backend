import { notify } from "../services/notifier.js";

class ContactController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.db = context.db;
  }

  async submit() {
    const { name, email, subject, message } = this.req.body;
    if (!name || !email || !subject || !message) {
      throw this.context.errorManager.getError("BAD_REQUEST", "All fields are required");
    }

    const contact = await this.db.ContactMessage.create({ name, email, subject, message });

    // Notify admin via email
    notify("CONTACT_RECEIVED", { name, email, subject, message });

    return { success: true, message: "Message sent. We'll get back to you soon." };
  }
}

export default ContactController;
