import CheckoutService from "../services/checkout.js";
import Stripe from "stripe";

class CheckoutController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.res = context.res;
    this.checkoutService = new CheckoutService(context);
  }

  async createSession() {
    const { shippingAddressId } = this.req.body;
    return this.checkoutService.createSession(this.req.user.id, shippingAddressId);
  }

  async webhook() {
    const sig = this.req.headers["stripe-signature"];
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        this.req.rawBody || this.req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      this.res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    await this.checkoutService.handleWebhook(event);
    this.res.json({ received: true });
  }
}

export default CheckoutController;
