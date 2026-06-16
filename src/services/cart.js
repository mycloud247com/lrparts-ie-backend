class CartService {
  constructor(context) {
    this.db = context.db;
    this.errorManager = context.errorManager;
  }

  async getOrCreateCart(userId) {
    let cart = await this.db.Cart.findOne({ where: { userId } });
    if (!cart) cart = await this.db.Cart.create({ userId });
    return cart;
  }

  async getCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.db.CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        { model: this.db.Kit, as: "kit", include: [{ model: this.db.KitItem, as: "items" }] },
      ],
      order: [["createdAt", "ASC"]],
    });

    const settings = await this.getSettings();
    const subtotal = items.reduce((sum, i) => sum + parseFloat(i.unitPrice) * i.quantity, 0);
    const shipping = subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingCost;
    const vat = +((subtotal + shipping) * settings.vatRate).toFixed(2);
    const total = +(subtotal + shipping + vat).toFixed(2);

    return {
      id: cart.id,
      items: items.map(i => ({
        id: i.id,
        articleNo: i.articleNo,
        name: i.name,
        image: i.image,
        quantity: i.quantity,
        unitPrice: parseFloat(i.unitPrice),
        lineTotal: +(parseFloat(i.unitPrice) * i.quantity).toFixed(2),
        isOurPart: i.isOurPart,
        delivery: i.delivery,
        kitId: i.kitId || null,
        kitItems: i.kit?.items?.map(ki => ({
          articleNo: ki.articleNo,
          name: ki.name,
          quantity: ki.quantity,
        })) || null,
      })),
      subtotal: +subtotal.toFixed(2),
      shipping,
      shippingNote: shipping === 0 ? "Free shipping" : `Free shipping over €${settings.freeShippingThreshold}`,
      vat,
      vatRate: settings.vatRate,
      total,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      freeShippingThreshold: settings.freeShippingThreshold,
    };
  }

  async addItem(userId, data) {
    const { articleNo, name, image, unitPrice, isOurPart, delivery, quantity = 1 } = data;
    if (!articleNo || !name || unitPrice === undefined) {
      throw this.errorManager.getError("BAD_REQUEST", "articleNo, name, and unitPrice are required");
    }

    const cart = await this.getOrCreateCart(userId);

    // Check if already in cart
    const existing = await this.db.CartItem.findOne({ where: { cartId: cart.id, articleNo } });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      return this.getCart(userId);
    }

    await this.db.CartItem.create({
      cartId: cart.id,
      articleNo,
      name,
      image: image || null,
      quantity,
      unitPrice,
      isOurPart: isOurPart || false,
      delivery: delivery || "3-4 business days",
    });

    return this.getCart(userId);
  }

  async addKit(userId, kitId, quantity = 1) {
    const kit = await this.db.Kit.findOne({
      where: { id: kitId, isActive: true },
      include: [{ model: this.db.KitItem, as: "items" }],
    });
    if (!kit) throw this.errorManager.getError("NOT_FOUND", "Kit not found");

    const cart = await this.getOrCreateCart(userId);

    // Check if this kit is already in cart
    const existing = await this.db.CartItem.findOne({
      where: { cartId: cart.id, kitId: kit.id },
    });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      return this.getCart(userId);
    }

    // Calculate kit price from individual products
    const KitService = (await import("./kit.js")).default;
    const kitService = new KitService({ db: this.db, errorManager: this.errorManager });
    const displayPrice = await kitService.getKitDisplayPrice(kitId);

    await this.db.CartItem.create({
      cartId: cart.id,
      articleNo: `KIT-${kit.slug}`,
      name: kit.name,
      image: kit.imageUrl || null,
      quantity,
      unitPrice: displayPrice,
      isOurPart: true,
      delivery: "Next day delivery",
      kitId: kit.id,
    });

    return this.getCart(userId);
  }

  async updateItemQty(userId, itemId, quantity) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.db.CartItem.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw this.errorManager.getError("NOT_FOUND");

    if (quantity <= 0) {
      await item.destroy();
    } else {
      item.quantity = quantity;
      await item.save();
    }
    return this.getCart(userId);
  }

  async removeItem(userId, itemId) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.db.CartItem.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw this.errorManager.getError("NOT_FOUND");
    await item.destroy();
    return this.getCart(userId);
  }

  async clearCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    await this.db.CartItem.destroy({ where: { cartId: cart.id } });
    return this.getCart(userId);
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

export default CartService;
