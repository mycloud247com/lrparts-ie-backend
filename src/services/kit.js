import { slugify } from "../utils/helper.js";
import ridexService from "./ridex.js";

class KitService {
  constructor(context) {
    this.db = context.db;
    this.Op = context.db.Sequelize.Op;
    this.errorManager = context.errorManager;
  }

  /**
   * Calculate kit price from individual product prices.
   * Looks up each item's price from InventoryItem (customPrice) or Product (ridexPrice × multiplier).
   */
  async calculateKitPrice(kit) {
    const settings = await this.getSettings();
    const articleNos = (kit.items || []).map((i) => i.articleNo);
    if (articleNos.length === 0) return 0;

    // Look up prices: inventory first (only if stock > 0), then RIDEX API
    const inventory = await this.db.InventoryItem.findAll({
      where: { ridexArticleNo: { [this.Op.in]: articleNos }, isActive: true },
    });
    const inventoryMap = {};
    for (const inv of inventory) {
      // Only use inventory if it has stock
      if (inv.ridexArticleNo && inv.customStock > 0) {
        inventoryMap[inv.ridexArticleNo.toUpperCase()] = inv;
      }
    }

    // Fetch live prices from RIDEX API for items not in inventory (or out of stock)
    const needRidexPrice = articleNos.filter((a) => !inventoryMap[a.toUpperCase()]);
    const ridexPriceMap = {};
    if (needRidexPrice.length > 0) {
      try {
        const articles = await ridexService.getArticles(needRidexPrice);
        for (const a of articles) {
          if (a.ArticleNo && a.Price) {
            ridexPriceMap[a.ArticleNo.toUpperCase()] = parseFloat(a.Price);
          }
        }
      } catch { /* RIDEX API unavailable — prices stay 0 */ }
    }

    let total = 0;
    const itemsWithPrices = [];

    for (const item of kit.items) {
      const key = (item.articleNo || "").toUpperCase();
      const inv = inventoryMap[key];

      let itemPrice = 0;
      if (inv?.customPrice) {
        itemPrice = parseFloat(inv.customPrice);
      } else if (ridexPriceMap[key]) {
        itemPrice = +(ridexPriceMap[key] * settings.priceMultiplier).toFixed(2);
      }

      total += itemPrice * (item.quantity || 1);
      itemsWithPrices.push({
        articleNo: item.articleNo,
        name: item.name,
        quantity: item.quantity,
        unitPrice: itemPrice,
        sortOrder: item.sortOrder,
      });
    }

    // Fetch OEM numbers for all items
    if (this.db.OemNumber) {
      const [oemRows] = await this.db.sequelize.query(`
        SELECT p.article_no, array_agg(DISTINCT o.oem_number) as oems
        FROM oem_numbers o
        JOIN products p ON p.id = o.product_id
        WHERE p.article_no IN (:articleNos)
        GROUP BY p.article_no
      `, { replacements: { articleNos } });
      const oemMap = {};
      for (const r of oemRows) oemMap[r.article_no.toUpperCase()] = r.oems;
      for (const item of itemsWithPrices) {
        item.oem = (oemMap[(item.articleNo || "").toUpperCase()] || []).slice(0, 3);
      }
    }

    // Apply discount
    const discount = parseFloat(kit.discountPercent) || 0;
    if (discount > 0) {
      total = +(total * (1 - discount / 100)).toFixed(2);
    }

    return { total: +total.toFixed(2), items: itemsWithPrices };
  }

  /**
   * Enrich kit(s) with calculated prices
   */
  async enrichKit(kit) {
    const plain = kit.toJSON ? kit.toJSON() : { ...kit };
    const { total, items } = await this.calculateKitPrice(plain);
    plain.calculatedPrice = total;
    plain.displayPrice = plain.price ? parseFloat(plain.price) : total;
    plain.items = items;
    return plain;
  }

  async enrichKits(kits) {
    return Promise.all(kits.map((k) => this.enrichKit(k)));
  }

  // ─── Public ───────────────────────────────────────────────────

  async getAll() {
    const kits = await this.db.Kit.findAll({
      where: { isActive: true },
      include: [
        { model: this.db.KitItem, as: "items" },
        { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["id", "ridexId", "name", "slug"] },
        { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["id", "ridexId", "name", "displacement", "power", "fuelType"] },
      ],
      order: [["sortOrder", "ASC"]],
    });
    return this.enrichKits(kits);
  }

  async getByVehicle(modelRidexId, engineRidexId) {
    const where = { isActive: true };
    if (engineRidexId) {
      const engine = await this.db.VehicleEngine.findOne({ where: { ridexId: String(engineRidexId) } });
      if (engine) where.vehicleEngineId = engine.id;
      else return [];
    } else if (modelRidexId) {
      const model = await this.db.VehicleModel.findOne({ where: { ridexId: String(modelRidexId) } });
      if (model) where.vehicleModelId = model.id;
      else return [];
    }
    const kits = await this.db.Kit.findAll({
      where,
      include: [
        { model: this.db.KitItem, as: "items" },
        { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["id", "ridexId", "name", "slug"] },
        { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["id", "ridexId", "name", "displacement", "power", "fuelType"] },
      ],
      order: [["sortOrder", "ASC"]],
    });
    return this.enrichKits(kits);
  }

  async getByVehicleModel(vehicleModelId) {
    const kits = await this.db.Kit.findAll({
      where: { vehicleModelId, isActive: true },
      include: [
        { model: this.db.KitItem, as: "items" },
        { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["id", "ridexId", "name", "slug"] },
        { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["id", "ridexId", "name", "displacement", "power", "fuelType"] },
      ],
      order: [["sortOrder", "ASC"]],
    });
    return this.enrichKits(kits);
  }

  async getBySlug(slug) {
    const kit = await this.db.Kit.findOne({
      where: { slug, isActive: true },
      include: [
        { model: this.db.KitItem, as: "items" },
        { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["id", "ridexId", "name", "slug"] },
        { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["id", "ridexId", "name", "displacement", "power", "fuelType"] },
      ],
    });
    if (!kit) throw this.errorManager.getError("NOT_FOUND");
    return this.enrichKit(kit);
  }

  /**
   * Get the display price for a kit (for cart/checkout)
   */
  async getKitDisplayPrice(kitId) {
    const kit = await this.db.Kit.findByPk(kitId, {
      include: [{ model: this.db.KitItem, as: "items" }],
    });
    if (!kit) return 0;
    if (kit.price) return parseFloat(kit.price);
    const { total } = await this.calculateKitPrice(kit);
    return total;
  }

  // ─── Admin ────────────────────────────────────────────────────

  async adminGetAll() {
    const kits = await this.db.Kit.findAll({
      include: [
        { model: this.db.KitItem, as: "items" },
        { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["id", "ridexId", "name", "slug"] },
        { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["id", "ridexId", "name", "displacement", "power", "fuelType"] },
      ],
      order: [["sortOrder", "ASC"], ["createdAt", "DESC"]],
    });
    return this.enrichKits(kits);
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

  async create(data) {
    const { name, description, price, discountPercent, imageUrl, vehicleModelId, items } = data;
    if (!name) {
      throw this.errorManager.getError("BAD_REQUEST", "name is required");
    }

    const kit = await this.db.Kit.create({
      name,
      slug: slugify(name),
      description: description || null,
      price: price ?? null,
      discountPercent: discountPercent ?? 0,
      imageUrl: imageUrl || null,
      vehicleModelId: vehicleModelId || null,
      vehicleEngineId: data.vehicleEngineId || null,
    });

    if (items && items.length > 0) {
      await this.db.KitItem.bulkCreate(
        items.map((item, i) => ({
          kitId: kit.id,
          articleNo: item.articleNo,
          name: item.name,
          quantity: item.quantity || 1,
          sortOrder: i,
        }))
      );
    }

    return this.db.Kit.findByPk(kit.id, {
      include: [
        { model: this.db.KitItem, as: "items" },
        { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["id", "ridexId", "name", "slug"] },
        { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["id", "ridexId", "name", "displacement", "power", "fuelType"] },
      ],
    });
  }

  async update(id, data) {
    const kit = await this.db.Kit.findByPk(id);
    if (!kit) throw this.errorManager.getError("NOT_FOUND");

    const updates = {};
    if (data.name !== undefined) {
      updates.name = data.name;
      updates.slug = slugify(data.name);
    }
    if (data.description !== undefined) updates.description = data.description;
    if (data.price !== undefined) updates.price = data.price;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
    if (data.vehicleModelId !== undefined) updates.vehicleModelId = data.vehicleModelId;
    if (data.vehicleEngineId !== undefined) updates.vehicleEngineId = data.vehicleEngineId;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;

    await kit.update(updates);
    return kit;
  }

  async delete(id) {
    const kit = await this.db.Kit.findByPk(id);
    if (!kit) throw this.errorManager.getError("NOT_FOUND");
    await kit.update({ isActive: false });
    return { message: "Kit deactivated" };
  }

  async updateItems(kitId, items) {
    const kit = await this.db.Kit.findByPk(kitId);
    if (!kit) throw this.errorManager.getError("NOT_FOUND");

    // Replace all items
    await this.db.KitItem.destroy({ where: { kitId } });
    if (items && items.length > 0) {
      await this.db.KitItem.bulkCreate(
        items.map((item, i) => ({
          kitId,
          articleNo: item.articleNo,
          name: item.name,
          quantity: item.quantity || 1,
          sortOrder: i,
        }))
      );
    }

    return this.db.Kit.findByPk(kitId, {
      include: [{ model: this.db.KitItem, as: "items" }],
    });
  }
}

export default KitService;
