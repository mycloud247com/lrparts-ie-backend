import OrderService from "../services/order.js";

class OrderController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.orderService = new OrderService(context);
  }

  async list() {
    const { page, limit } = this.req.query;
    return this.orderService.getUserOrders(this.req.user.id, page, limit);
  }

  async getByNumber() {
    return this.orderService.getOrderByNumber(this.req.user.id, this.req.params.orderNumber);
  }

  async trackOrder() {
    const { orderNumber, email } = this.req.body;
    if (!orderNumber || !email) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Order number and email are required");
    }
    return this.orderService.trackOrder(orderNumber, email);
  }

  async cancelOrder() {
    return this.orderService.cancelPendingOrder(this.req.user.id, this.req.params.orderNumber);
  }

  async getCheckoutUrl() {
    return this.orderService.getCheckoutUrl(this.req.user.id, this.req.params.orderNumber);
  }

  async getBySessionId() {
    const { session_id } = this.req.query;
    return this.orderService.getOrderBySessionId(this.req.user.id, session_id);
  }
}

export default OrderController;
