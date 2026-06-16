import CartService from "../services/cart.js";

class CartController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.cartService = new CartService(context);
  }

  async getCart() {
    return this.cartService.getCart(this.req.user.id);
  }

  async addItem() {
    return this.cartService.addItem(this.req.user.id, this.req.body);
  }

  async addKit() {
    const { kitId, quantity } = this.req.body;
    return this.cartService.addKit(this.req.user.id, kitId, quantity || 1);
  }

  async updateItem() {
    const { quantity } = this.req.body;
    return this.cartService.updateItemQty(this.req.user.id, this.req.params.id, quantity);
  }

  async removeItem() {
    return this.cartService.removeItem(this.req.user.id, this.req.params.id);
  }

  async clearCart() {
    return this.cartService.clearCart(this.req.user.id);
  }
}

export default CartController;
