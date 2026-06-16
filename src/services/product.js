import ridexService from "./ridex.js";
import ridexScraper from "./ridexScraper.js";

class ProductService {
  constructor(context) {
    this.context = context;
    this.db = context.db;
    this.Op = context.db.Sequelize.Op;
  }

  /**
   * Get products for a vehicle combo from database.
   * Filters by engine (car) or model via the product_vehicles fitment table.
   */
  async getProductsForVehicle(maker, model, car) {
    let engineFilter = "";
    const replacements = {};

    if (car) {
      engineFilter = `
        JOIN product_vehicles pv ON pv.product_id = p.id
        JOIN vehicle_engines ve ON ve.id = pv.vehicle_engine_id AND ve.ridex_id = :car
      `;
      replacements.car = String(car);
    } else if (model) {
      engineFilter = `
        JOIN product_vehicles pv ON pv.product_id = p.id
        JOIN vehicle_engines ve ON ve.id = pv.vehicle_engine_id
        JOIN vehicle_models vm ON vm.id = ve.vehicle_model_id AND vm.ridex_id = :model
      `;
      replacements.model = String(model);
    }

    const [rows] = await this.db.sequelize.query(`
      SELECT DISTINCT p.id, p.article_no, p.article_id, p.name, p.brand,
             p.ridex_price, p.ridex_quantity, p.ridex_category_slug, p.ean,
             pi.url as image_url
      FROM products p
      ${engineFilter}
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
      WHERE p.is_active = true
      ORDER BY p.name
    `, { replacements });

    const mapped = rows.map((r) => ({
      articleNo: r.article_no,
      articleId: r.article_id,
      name: r.name,
      image: r.image_url || (r.article_id ? `https://cdn.ridex.de/thumb?m=4&n=0&id=${r.article_id}&lng=en&typ=custom&cc=1` : null),
      ridexPrice: r.ridex_price ? parseFloat(r.ridex_price) : null,
      ridexQuantity: r.ridex_quantity,
      category: r.ridex_category_slug || null,
      specs: {},
    }));

    return this.enrichWithInventory(mapped);
  }

  /**
   * Overlay inventory data on products.
   */
  async enrichWithInventory(products) {
    const articleNos = products.map((p) => p.articleNo).filter(Boolean);
    if (articleNos.length === 0) return products;

    const settings = await this.getSettings();

    const inventory = await this.db.InventoryItem.findAll({
      where: {
        isActive: true,
        ridexArticleNo: { [this.Op.in]: articleNos },
      },
    });

    const articleMap = {};
    for (const item of inventory) {
      if (item.ridexArticleNo) {
        articleMap[item.ridexArticleNo.toUpperCase()] = item;
      }
    }

    return products.map((p) => {
      const inventoryItem = articleMap[(p.articleNo || "").toUpperCase()] || null;
      const isOurPart = !!inventoryItem;
      let displayPrice = p.ridexPrice ? +(parseFloat(p.ridexPrice) * settings.priceMultiplier).toFixed(2) : null;
      let stock = "supplier";
      const supplierDelivery = `${settings.leadTime}-${settings.leadTime + 1} business days`;
      let delivery = p.ridexQuantity > 0 ? supplierDelivery : null;

      if (isOurPart) {
        if (inventoryItem.customPrice) displayPrice = parseFloat(inventoryItem.customPrice);
        if (inventoryItem.customStock && inventoryItem.customStock > 0) {
          stock = inventoryItem.customStock <= 5 ? "low_stock" : "in_stock";
          delivery = "Next day delivery";
        }
        if (inventoryItem.imageUrl) {
          p.image = inventoryItem.imageUrl;
        }
      } else {
        if (p.ridexQuantity !== null) {
          if (p.ridexQuantity <= 0) stock = "out_of_stock";
          else stock = "supplier";
        }
      }

      return {
        ...p,
        price: displayPrice,
        stock,
        isOurPart,
        delivery,
        quantity: isOurPart ? (inventoryItem.customStock ?? 0) : (p.ridexQuantity ?? 0),
      };
    })
    // Inventory products first (in-stock > low-stock), then supplier, then out-of-stock
    .sort((a, b) => {
      const stockOrder = { in_stock: 0, low_stock: 1, supplier: 2, out_of_stock: 3 };
      if (a.isOurPart !== b.isOurPart) return a.isOurPart ? -1 : 1;
      return (stockOrder[a.stock] ?? 4) - (stockOrder[b.stock] ?? 4);
    });
  }

  /**
   * Product detail — fetched LIVE from RIDEX API v1 + v2, with inventory overlay.
   */
  async getProductDetail(articleNo) {
    let v1Article = null;
    let v2Article = null;

    try {
      const [v1Result, v2Result] = await Promise.all([
        ridexService.getArticles([articleNo]),
        ridexService.getArticleInfo([articleNo]),
      ]);
      v1Article = v1Result?.[0] || null;
      v2Article = v2Result?.[0] || null;

      if (!v1Article && !v2Article) {
        const searchResults = await ridexScraper.searchProducts(articleNo);
        if (searchResults.length > 0 && searchResults[0].articleNo) {
          const fallbackNo = searchResults[0].articleNo;
          const [v1f, v2f] = await Promise.all([
            ridexService.getArticles([fallbackNo]),
            ridexService.getArticleInfo([fallbackNo]),
          ]);
          v1Article = v1f?.[0] || null;
          v2Article = v2f?.[0] || null;
          if (v1Article) articleNo = fallbackNo;
        }
      }
    } catch { /* APIs failed */ }

    const ridexPrice = v1Article?.Price ? parseFloat(v1Article.Price) : null;
    let quantity = v1Article?.Quantity ?? null;
    const name = (v2Article?.productName || v1Article?.Name || "").replace(/\bRIDEX\b\s*/gi, "");

    let stockStatus = "unknown";
    if (quantity !== null) {
      if (quantity <= 0) stockStatus = "out_of_stock";
      else if (quantity <= 5) stockStatus = "low_stock";
      else stockStatus = "in_stock";
    }

    const specs = [];
    if (v2Article?.technicalSpecifications) {
      for (const [key, value] of Object.entries(v2Article.technicalSpecifications)) {
        if (key !== "Manufacturer") specs.push({ key, value });
      }
    }

    const rawPhotos = (v2Article?.photos && v2Article.photos !== "no results") ? v2Article.photos : [];
    const photos = rawPhotos.filter((url) => !url.includes("media.autodoc.de"));
    const oem = v2Article?.referenceNumbers?.OEM || [];
    const ean = v2Article?.referenceNumbers?.EAN || "";

    const inventoryMatch = await this.findInventoryMatch(oem, articleNo);
    const settings = await this.getSettings();

    const supplierDelivery = `${settings.leadTime}-${settings.leadTime + 1} business days`;
    let displayPrice = ridexPrice ? +(ridexPrice * settings.priceMultiplier).toFixed(2) : null;
    let isOurPart = false;
    let delivery = quantity > 0 ? supplierDelivery : null;

    if (inventoryMatch) {
      isOurPart = true;
      if (inventoryMatch.customPrice) displayPrice = parseFloat(inventoryMatch.customPrice);
      if (inventoryMatch.customStock && inventoryMatch.customStock > 0) {
        delivery = "Next day delivery";
        stockStatus = inventoryMatch.customStock <= 5 ? "low_stock" : "in_stock";
        quantity = inventoryMatch.customStock;
      }
    }

    const articleId = v1Article?.ArticleId || null;
    let compatibleVehicles = [];
    // Try live scrape from RIDEX
    if (articleId) {
      try {
        compatibleVehicles = await ridexScraper.scrapeCompatibleVehicles(articleId);
      } catch {}
    }
    // Always merge in Land Rover fitment from our DB (since we're a LR-specific store)
    const dbVehicles = await this.getCompatibleVehiclesFromDB(articleNo);
    if (dbVehicles.length > 0) {
      // Check if RIDEX already has a Land Rover entry
      const hasLR = compatibleVehicles.some(v => v.make.toLowerCase().includes("land rover"));
      if (!hasLR) {
        compatibleVehicles = [...dbVehicles, ...compatibleVehicles];
      }
    }

    return {
      articleNo, name, price: displayPrice, ridexPrice, quantity: quantity ?? 0,
      stock: stockStatus, specs, photos, oem, ean, isOurPart, delivery,
      compatibleVehicles, inventoryImage: inventoryMatch?.imageUrl || null,
    };
  }

  /**
   * Search products in database using full-text search + inventory.
   */
  async search(query) {
    const q = query.trim();
    let rawProducts = [];

    // 1. Own inventory matches
    const ownMatches = await this.db.InventoryItem.findAll({
      where: {
        isActive: true,
        [this.Op.or]: [
          { ridexArticleNo: { [this.Op.iLike]: q } },
          { oePartNo: { [this.Op.iLike]: `%${q}%` } },
          { partName: { [this.Op.iLike]: `%${q}%` } },
        ],
      },
    });

    // 2. Try exact article number or OEM number match first
    let dbProducts = [];

    // Check OEM numbers table
    const oemMatches = await this.db.OemNumber.findAll({
      where: { oemNumber: { [this.Op.iLike]: q } },
      attributes: ["productId"],
    });
    if (oemMatches.length > 0) {
      const productIds = [...new Set(oemMatches.map((o) => o.productId))];
      dbProducts = await this.db.Product.findAll({
        where: { id: { [this.Op.in]: productIds }, isActive: true },
        include: [
          { model: this.db.ProductImage, as: "images", where: { isPrimary: true }, required: false, attributes: ["url"] },
        ],
      });
    }

    // If no OEM match, try exact article number
    if (dbProducts.length === 0) {
      dbProducts = await this.db.Product.findAll({
        where: {
          isActive: true,
          articleNo: { [this.Op.iLike]: q },
        },
        include: [
          { model: this.db.ProductImage, as: "images", where: { isPrimary: true }, required: false, attributes: ["url"] },
        ],
        limit: 50,
      });
    }

    // If no exact match, do full-text search
    if (dbProducts.length === 0) {
      // Build tsquery — handle both single words and multi-word queries
      const tsQuery = q.split(/\s+/).filter(Boolean).map((w) => `${w}:*`).join(" & ");

      const [rows] = await this.db.sequelize.query(`
        SELECT p.id, p.article_no, p.article_id, p.name, p.ridex_price, p.ridex_quantity,
               p.ridex_category_slug, pi.url as image_url,
               ts_rank(p.search_vector, to_tsquery('english', :tsQuery)) as rank,
               CASE WHEN ii.id IS NOT NULL AND ii.custom_stock > 0 THEN 1 ELSE 0 END as in_inventory
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
        LEFT JOIN inventory_items ii ON ii.ridex_article_no = p.article_no AND ii.is_active = true
        WHERE p.is_active = true
          AND p.search_vector @@ to_tsquery('english', :tsQuery)
        ORDER BY in_inventory DESC, rank DESC
        LIMIT 100
      `, { replacements: { tsQuery } });

      rawProducts = rows.map((r) => ({
        articleNo: r.article_no,
        articleId: r.article_id,
        name: r.name,
        image: r.image_url || (r.article_id ? `https://cdn.ridex.de/thumb?m=4&n=0&id=${r.article_id}&lng=en&typ=custom&cc=1` : null),
        ridexPrice: r.ridex_price ? parseFloat(r.ridex_price) : null,
        ridexQuantity: r.ridex_quantity,
        category: r.ridex_category_slug || null,
      }));
    }

    // If exact match found, map those
    if (dbProducts.length > 0 && rawProducts.length === 0) {
      rawProducts = dbProducts.map((p) => ({
        articleNo: p.articleNo,
        articleId: p.articleId,
        name: p.name,
        image: p.images?.[0]?.url || (p.articleId ? `https://cdn.ridex.de/thumb?m=4&n=0&id=${p.articleId}&lng=en&typ=custom&cc=1` : null),
        ridexPrice: p.ridexPrice ? parseFloat(p.ridexPrice) : null,
        ridexQuantity: p.ridexQuantity,
        category: p.ridexCategorySlug || null,
      }));
    }

    // If still nothing, try ILIKE on name
    if (rawProducts.length === 0) {
      const likeProducts = await this.db.Product.findAll({
        where: {
          isActive: true,
          name: { [this.Op.iLike]: `%${q}%` },
        },
        include: [
          { model: this.db.ProductImage, as: "images", where: { isPrimary: true }, required: false, attributes: ["url"] },
        ],
        limit: 100,
      });

      rawProducts = likeProducts.map((p) => ({
        articleNo: p.articleNo,
        articleId: p.articleId,
        name: p.name,
        image: p.images?.[0]?.url || (p.articleId ? `https://cdn.ridex.de/thumb?m=4&n=0&id=${p.articleId}&lng=en&typ=custom&cc=1` : null),
        ridexPrice: p.ridexPrice ? parseFloat(p.ridexPrice) : null,
        ridexQuantity: p.ridexQuantity,
        category: p.ridexCategorySlug || null,
      }));
    }

    // Merge own inventory items not already in results
    const resultArticleNos = new Set(rawProducts.map((p) => (p.articleNo || "").toUpperCase()));
    const inventoryOnlyItems = ownMatches.filter((item) => !resultArticleNos.has((item.ridexArticleNo || "").toUpperCase()));

    // Try to fetch images from RIDEX for inventory items without images
    if (inventoryOnlyItems.length > 0) {
      const needImage = inventoryOnlyItems.filter((item) => !item.imageUrl && item.ridexArticleNo);
      if (needImage.length > 0) {
        try {
          const articles = await ridexService.getArticles(needImage.map((i) => i.ridexArticleNo));
          const articleMap = {};
          for (const a of articles) {
            if (a.ArticleNo && a.ArticleId) articleMap[a.ArticleNo.toUpperCase()] = a.ArticleId;
          }
          for (const item of needImage) {
            const articleId = articleMap[(item.ridexArticleNo || "").toUpperCase()];
            if (articleId) item._ridexImage = `https://cdn.ridex.de/thumb?m=4&n=0&id=${articleId}&lng=en&typ=custom&cc=1`;
          }
        } catch { /* RIDEX unavailable */ }
      }
    }

    for (const item of inventoryOnlyItems) {
      rawProducts.unshift({
        articleNo: item.ridexArticleNo,
        name: item.partName || item.ridexArticleNo,
        image: item.imageUrl || item._ridexImage || null,
        ridexPrice: null,
        ridexQuantity: null,
      });
    }

    const enriched = await this.enrichWithInventory(rawProducts);
    return { products: enriched, source: rawProducts.length > 0 ? "database" : "none" };
  }

  /**
   * Find inventory match by article number or OEM.
   */
  async findInventoryMatch(oemNumbers, articleNo) {
    if (articleNo) {
      const match = await this.db.InventoryItem.findOne({
        where: { ridexArticleNo: articleNo, isActive: true },
      });
      if (match) return match;
    }

    if (oemNumbers && oemNumbers.length > 0) {
      const orClauses = oemNumbers.map((n) => ({ [this.Op.iLike]: `%${n}%` }));
      const match = await this.db.InventoryItem.findOne({
        where: {
          isActive: true,
          oePartNo: { [this.Op.or]: orClauses },
        },
      });
      return match;
    }

    return null;
  }

  /**
   * Get compatible vehicles from DB fitment table (product_vehicles → vehicle_engines → vehicle_models).
   */
  async getCompatibleVehiclesFromDB(articleNo) {
    try {
      const [rows] = await this.db.sequelize.query(`
        SELECT vm.name AS model_name, ve.name AS engine_name
        FROM product_vehicles pv
        JOIN products p ON p.id = pv.product_id
        JOIN vehicle_engines ve ON ve.id = pv.vehicle_engine_id
        JOIN vehicle_models vm ON vm.id = ve.vehicle_model_id
        WHERE p.article_no = :articleNo
        ORDER BY vm.name, ve.name
      `, { replacements: { articleNo } });

      if (!rows || rows.length === 0) return [];

      // Group engines under model names
      const modelMap = new Map();
      for (const row of rows) {
        const modelName = row.model_name || "Unknown";
        if (!modelMap.has(modelName)) modelMap.set(modelName, []);
        modelMap.get(modelName).push(row.engine_name || "Unknown engine");
      }

      return [{
        make: "Land Rover",
        models: Array.from(modelMap.entries()).map(([summary, engines]) => ({ summary, engines })),
      }];
    } catch (err) {
      console.error("[getCompatibleVehiclesFromDB] Error:", err.message);
      return [];
    }
  }

  /**
   * Featured products from own inventory.
   */
  async getFeaturedProducts(limit = 8) {
    const items = await this.db.InventoryItem.findAll({
      where: { isActive: true },
      order: [["updatedAt", "DESC"]],
      limit,
    });

    const products = items.map((item) => ({
      articleNo: item.ridexArticleNo,
      slug: item.ridexArticleNo,
      name: item.partName || item.ridexArticleNo,
      oemNumber: item.oePartNo || null,
      price: item.customPrice ? parseFloat(item.customPrice) : null,
      stock: item.customStock > 5 ? "in_stock" : item.customStock > 0 ? "low_stock" : "out_of_stock",
      isOurPart: true,
      isOurStock: true,
      brand: "LR Parts",
      image: item.imageUrl || null,
      delivery: "Next day delivery",
      quantity: item.customStock ?? 0,
    }));

    return { products };
  }

  /**
   * Settings — fetched from DB each time.
   */
  async getSettings() {
    const rows = await this.db.Setting.findAll();
    const s = {};
    for (const r of rows) s[r.key] = r.value;
    return {
      priceMultiplier: s.priceMultiplier != null ? parseFloat(s.priceMultiplier) : 1.3,
      vatRate: s.vatRate != null ? parseFloat(s.vatRate) : 0.23,
      freeShippingThreshold: s.freeShippingThreshold != null ? parseFloat(s.freeShippingThreshold) : 100,
      shippingCost: s.shippingCost != null ? parseFloat(s.shippingCost) : 7.95,
      leadTime: s.leadTime != null ? parseInt(s.leadTime) : 3,
    };
  }
}

export default ProductService;
