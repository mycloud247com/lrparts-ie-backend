import Stripe from "stripe";
import { generateOrderNumber } from "../utils/helper.js";
import { notify } from "./notifier.js";

class CheckoutService {
  constructor(context) {
    this.db = context.db;
    this.errorManager = context.errorManager;
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createSession(userId, shippingAddressId) {
    const user = await this.db.User.findByPk(userId);
    if (!user) throw this.errorManager.getError("USER_NOT_FOUND");
    if (!user.emailVerified) throw this.errorManager.getError("FORBIDDEN", "Please verify your email before placing an order.");

    const cart = await this.db.Cart.findOne({ where: { userId } });
    if (!cart) throw this.errorManager.getError("CART_EMPTY");

    const cartItems = await this.db.CartItem.findAll({ where: { cartId: cart.id } });
    if (cartItems.length === 0) throw this.errorManager.getError("CART_EMPTY");

    // Calculate totals
    const settings = await this.getSettings();
    const subtotal = cartItems.reduce((sum, i) => sum + parseFloat(i.unitPrice) * i.quantity, 0);
    const shipping = subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingCost;
    const vat = +((subtotal + shipping) * settings.vatRate).toFixed(2);
    const total = +(subtotal + shipping + vat).toFixed(2);

    // ─── Create order FIRST (status: pending) ───
    const order = await this.db.Order.create({
      userId,
      orderNumber: generateOrderNumber(),
      status: "pending",
      subtotal,
      shipping,
      vat,
      vatRate: settings.vatRate,
      total,
      shippingAddressId: shippingAddressId || null,
    });

    // Create order items — expand kits into individual products
    for (const item of cartItems) {
      if (item.kitId) {
        // Kit item — expand to individual products
        const kit = await this.db.Kit.findByPk(item.kitId, {
          include: [{ model: this.db.KitItem, as: "items" }],
        });
        if (kit && kit.items.length > 0) {
          // Distribute kit price across items proportionally (or equal)
          const perItemPrice = +(parseFloat(item.unitPrice) / kit.items.length).toFixed(2);
          for (const ki of kit.items) {
            await this.db.OrderItem.create({
              orderId: order.id,
              articleNo: ki.articleNo,
              name: ki.name,
              quantity: ki.quantity * item.quantity,
              unitPrice: perItemPrice,
              lineTotal: +(perItemPrice * ki.quantity * item.quantity).toFixed(2),
              source: "warehouse",
              isOurPart: true,
              delivery: item.delivery,
              kitId: kit.id,
              kitName: kit.name,
            });
          }
        }
      } else {
        await this.db.OrderItem.create({
          orderId: order.id,
          articleNo: item.articleNo,
          name: item.name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          lineTotal: +(parseFloat(item.unitPrice) * item.quantity).toFixed(2),
          source: item.isOurPart ? "warehouse" : "supplier",
          isOurPart: item.isOurPart,
          delivery: item.delivery,
        });
      }
    }

    // Log initial status
    await this.db.OrderStatusLog.create({
      orderId: order.id,
      fromStatus: null,
      toStatus: "pending",
      note: "Order created, awaiting payment",
    });

    // Clear cart
    await this.db.CartItem.destroy({ where: { cartId: cart.id } });

    // ─── Create Stripe checkout session ───
    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: item.name,
          metadata: { articleNo: item.articleNo },
        },
        unit_amount: Math.round(parseFloat(item.unitPrice) * 100),
      },
      quantity: item.quantity,
    }));

    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Shipping" },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    if (vat > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: `VAT (${Math.round(settings.vatRate * 100)}%)` },
          unit_amount: Math.round(vat * 100),
        },
        quantity: 1,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email,
      line_items: lineItems,
      metadata: {
        orderId: order.id,
        userId,
      },
      success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/account/orders/${order.orderNumber}`,
    });

    // Store Stripe session ID on the order
    await order.update({ stripeSessionId: session.id });

    return { sessionId: session.id, url: session.url, orderNumber: order.orderNumber };
  }

  // ─── Webhook: confirm payment ───
  async handleWebhook(event) {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await this.confirmPayment(session);
    }
  }

  async confirmPayment(session) {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    const order = await this.db.Order.findByPk(orderId);
    if (!order) return;

    // Already confirmed (webhook + on-demand race)
    if (order.status !== "pending") return;

    // Update order to confirmed
    await order.update({
      status: "confirmed",
      stripePaymentIntentId: session.payment_intent,
    });

    // Log status change
    await this.db.OrderStatusLog.create({
      orderId: order.id,
      fromStatus: "pending",
      toStatus: "confirmed",
      note: "Payment confirmed via Stripe",
    });

    // Decrement warehouse stock
    const items = await this.db.OrderItem.findAll({ where: { orderId: order.id } });
    for (const item of items) {
      if (item.isOurPart) {
        await this.db.InventoryItem.update(
          {
            customStock: this.db.Sequelize.literal(
              `GREATEST(0, COALESCE(custom_stock, 0) - ${parseInt(item.quantity)})`
            ),
          },
          { where: { ridexArticleNo: item.articleNo, isActive: true } }
        );
      }
    }

    // Send confirmation email
    const user = await this.db.User.findByPk(order.userId);
    if (user) {
      notify("ORDER_CONFIRMED", {
        user,
        order,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          lineTotal: parseFloat(i.unitPrice) * i.quantity,
        })),
      });
    }

    return order;
  }

  async getSettings() {
    const rows = await this.db.Setting.findAll();
    const s = {};
    for (const r of rows) s[r.key] = r.value;
    return {
      priceMultiplier: s.priceMultiplier != null ? parseFloat(s.priceMultiplier) : 1.3,
      vatRate: s.vatRate != null ? parseFloat(s.vatRate) : 0.23,
      freeShippingThreshold: s.freeShippingThreshold != null ? parseFloat(s.freeShippingThreshold) : 100,
      shippingCost: s.shippingCost != null ? parseFloat(s.shippingCost) : 7.95,
    };
  }
}

export default CheckoutService;
