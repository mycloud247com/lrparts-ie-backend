import Stripe from "stripe";

class OrderService {
  constructor(context) {
    this.db = context.db;
    this.errorManager = context.errorManager;
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async trackOrder(orderNumber, email) {
    const order = await this.db.Order.findOne({
      where: { orderNumber },
      include: [
        { model: this.db.User, as: "user", attributes: ["email"] },
        { model: this.db.OrderItem, as: "items" },
        { model: this.db.OrderStatusLog, as: "statusLogs", order: [["createdAt", "ASC"]] },
      ],
    });

    if (!order || order.user.email.toLowerCase() !== email.toLowerCase()) {
      throw this.errorManager.getError("NOT_FOUND", "Order not found. Check your order number and email.");
    }

    // Return safe subset — no user details, no Stripe IDs
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      shipping: order.shipping,
      vat: order.vat,
      vatRate: order.vatRate != null ? parseFloat(order.vatRate) : null,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      carrier: order.carrier,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        name: i.name,
        articleNo: i.articleNo,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        source: i.source,
        delivery: i.delivery,
        kitId: i.kitId || null,
        kitName: i.kitName || null,
      })),
      statusLogs: order.statusLogs.map((l) => ({
        toStatus: l.toStatus,
        note: l.note,
        createdAt: l.createdAt,
      })),
    };
  }

  async cancelPendingOrder(userId, orderNumber) {
    const order = await this.db.Order.findOne({ where: { userId, orderNumber } });
    if (!order) throw this.errorManager.getError("NOT_FOUND", "Order not found");
    if (order.status !== "pending") {
      throw this.errorManager.getError("BAD_REQUEST", "Only pending orders can be cancelled");
    }

    await order.update({ status: "cancelled" });
    await this.db.OrderStatusLog.create({
      orderId: order.id,
      fromStatus: "pending",
      toStatus: "cancelled",
      note: "Cancelled by customer",
    });

    return { success: true, message: "Order cancelled" };
  }

  async getCheckoutUrl(userId, orderNumber) {
    const order = await this.db.Order.findOne({
      where: { userId, orderNumber },
      include: [{ model: this.db.OrderItem, as: "items" }],
    });
    if (!order) throw this.errorManager.getError("NOT_FOUND", "Order not found");
    if (order.status !== "pending") {
      throw this.errorManager.getError("BAD_REQUEST", "Order is not pending payment");
    }

    // Check if existing Stripe session is still valid
    if (order.stripeSessionId) {
      try {
        const session = await this.stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (session.status === "open" && session.url) {
          return { url: session.url };
        }
      } catch { /* session expired or invalid */ }
    }

    // Create a new Stripe session for this order
    const user = await this.db.User.findByPk(userId);
    const lineItems = order.items.map((item) => ({
      price_data: {
        currency: "eur",
        product_data: { name: item.name },
        unit_amount: Math.round(parseFloat(item.unitPrice) * 100),
      },
      quantity: item.quantity,
    }));

    if (parseFloat(order.shipping) > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Shipping" },
          unit_amount: Math.round(parseFloat(order.shipping) * 100),
        },
        quantity: 1,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user?.email,
      line_items: lineItems,
      metadata: { orderId: order.id, userId },
      success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/account/orders/${order.orderNumber}`,
    });

    await order.update({ stripeSessionId: session.id });

    return { url: session.url };
  }

  async getUserOrders(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.db.Order.findAndCountAll({
      where: { userId },
      include: [{ model: this.db.OrderItem, as: "items" }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    return {
      orders: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    };
  }

  async getOrderByNumber(userId, orderNumber) {
    const order = await this.db.Order.findOne({
      where: { userId, orderNumber },
      include: [
        { model: this.db.OrderItem, as: "items" },
        { model: this.db.OrderStatusLog, as: "statusLogs", order: [["createdAt", "ASC"]] },
        { model: this.db.UserAddress, as: "shippingAddress" },
      ],
    });
    if (!order) throw this.errorManager.getError("ORDER_NOT_FOUND");
    return order;
  }

  async getOrderBySessionId(userId, sessionId) {
    let order = await this.db.Order.findOne({
      where: { userId, stripeSessionId: sessionId },
      include: [{ model: this.db.OrderItem, as: "items" }],
    });

    if (!order) return null;

    // If order is still pending, check Stripe to see if payment went through
    if (order.status === "pending") {
      try {
        const session = await this.stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
          const CheckoutService = (await import("./checkout.js")).default;
          const checkoutService = new CheckoutService({
            db: this.db,
            errorManager: this.errorManager,
          });
          await checkoutService.confirmPayment(session);

          // Re-fetch with updated status
          order = await this.db.Order.findOne({
            where: { userId, stripeSessionId: sessionId },
            include: [{ model: this.db.OrderItem, as: "items" }],
          });
        }
      } catch (err) {
        console.error("[OrderService] On-demand Stripe check failed:", err.message);
      }
    }

    return order;
  }
}

export default OrderService;
