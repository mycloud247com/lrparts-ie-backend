import { notify } from "./notifier.js";
import cache from "./cache.js";

class AdminService {
  constructor(context) {
    this.context = context;
    this.db = context.db;
  }

  async getDashboard() {
    const Op = this.db.Sequelize.Op;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalOrders = await this.db.Order.count();
    const totalRevenue = (await this.db.Order.sum("total")) || 0;
    const totalCustomers = await this.db.User.count({ where: { role: "user" } });

    // Revenue by period
    const revenueToday = (await this.db.Order.sum("total", { where: { createdAt: { [Op.gte]: todayStart } } })) || 0;
    const revenueWeek = (await this.db.Order.sum("total", { where: { createdAt: { [Op.gte]: weekAgo } } })) || 0;
    const revenueMonth = (await this.db.Order.sum("total", { where: { createdAt: { [Op.gte]: monthAgo } } })) || 0;

    // Orders by status
    const ordersByStatus = {};
    const statusCounts = await this.db.Order.findAll({
      attributes: ["status", [this.db.Sequelize.fn("COUNT", "id"), "count"]],
      group: ["status"],
      raw: true,
    });
    for (const row of statusCounts) {
      ordersByStatus[row.status] = parseInt(row.count);
    }

    const recentOrders = await this.db.Order.findAll({
      order: [["createdAt", "DESC"]],
      limit: 10,
      include: [
        { model: this.db.User, as: "user", attributes: ["id", "firstName", "lastName", "email"] },
        { model: this.db.OrderItem, as: "items" },
      ],
    });

    const lowStockItems = await this.db.InventoryItem.findAll({
      where: this.db.Sequelize.where(
        this.db.Sequelize.col("custom_stock"),
        { [Op.lte]: this.db.Sequelize.col("min_qty") }
      ),
      order: [["customStock", "ASC"]],
      limit: 10,
    });

    return {
      totalOrders,
      totalRevenue,
      totalCustomers,
      revenue: { today: revenueToday, week: revenueWeek, month: revenueMonth },
      ordersByStatus,
      recentOrders,
      lowStockItems,
    };
  }

  async getOrders(page = 1, limit = 20, status) {
    const offset = (page - 1) * limit;
    const where = {};
    if (status) where.status = status;

    const { count, rows } = await this.db.Order.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: this.db.User, as: "user", attributes: ["id", "firstName", "lastName", "email"] },
        { model: this.db.OrderItem, as: "items" },
      ],
    });

    return {
      orders: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    };
  }

  async getOrderStripeDetails(orderId) {
    const order = await this.db.Order.findByPk(orderId);
    if (!order) throw this.context.errorManager.getError("NOT_FOUND", "Order not found");
    if (!order.stripePaymentIntentId && !order.stripeSessionId) {
      return { message: "No Stripe payment data" };
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const result = { paymentIntent: null, charges: [], receiptUrl: null };

    try {
      if (order.stripePaymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ["latest_charge"] });
        result.paymentIntent = {
          id: pi.id,
          amount: pi.amount / 100,
          currency: pi.currency,
          status: pi.status,
          created: new Date(pi.created * 1000).toISOString(),
          paymentMethod: pi.payment_method_types?.[0] || "card",
        };
        // Get receipt URL from latest charge
        const charge = pi.latest_charge;
        if (charge && typeof charge === "object") {
          result.charges = [{
            id: charge.id,
            amount: charge.amount / 100,
            status: charge.status,
            receiptUrl: charge.receipt_url,
            created: new Date(charge.created * 1000).toISOString(),
          }];
          result.receiptUrl = charge.receipt_url || null;
        }
      }
    } catch (err) {
      console.error("[Admin] Stripe fetch failed:", err.message);
    }

    return result;
  }

  async getOrderDetail(orderId) {
    const order = await this.db.Order.findByPk(orderId, {
      include: [
        { model: this.db.User, as: "user", attributes: { exclude: ["password", "resetToken", "resetTokenExpiry", "verificationToken"] } },
        { model: this.db.OrderItem, as: "items" },
        { model: this.db.OrderStatusLog, as: "statusLogs", order: [["createdAt", "ASC"]] },
        { model: this.db.UserAddress, as: "shippingAddress" },
      ],
    });
    if (!order) throw this.context.errorManager.getError("NOT_FOUND", "Order not found");
    return order;
  }

  async updateOrderStatus(orderId, newStatus, note, tracking) {
    const order = await this.db.Order.findByPk(orderId);
    if (!order) {
      throw this.context.errorManager.getError("NOT_FOUND", "Order not found");
    }

    const previousStatus = order.status;
    order.status = newStatus;

    // Update tracking info if provided
    if (tracking) {
      if (tracking.trackingNumber !== undefined) order.trackingNumber = tracking.trackingNumber;
      if (tracking.trackingUrl !== undefined) order.trackingUrl = tracking.trackingUrl;
      if (tracking.carrier !== undefined) order.carrier = tracking.carrier;
    }

    await order.save();

    await this.db.OrderStatusLog.create({
      orderId: order.id,
      fromStatus: previousStatus,
      toStatus: newStatus,
      note: note || null,
    });

    // Send status notification email
    const statusIntentMap = {
      processing: "ORDER_PROCESSING",
      shipped: "ORDER_SHIPPED",
      delivered: "ORDER_DELIVERED",
      cancelled: "ORDER_CANCELLED",
    };
    const intentKey = statusIntentMap[newStatus];
    if (intentKey) {
      const user = await this.db.User.findByPk(order.userId);
      if (user) {
        notify(intentKey, { user, order });
      }
    }

    return order;
  }

  async getCustomers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { count, rows } = await this.db.User.findAndCountAll({
      where: { role: "user" },
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: {
        include: [
          [
            this.db.Sequelize.literal(
              `(SELECT COUNT(*) FROM "orders" WHERE "orders"."user_id" = "User"."id")`
            ),
            "orderCount",
          ],
        ],
      },
    });

    return {
      customers: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    };
  }

  async getCustomerDetail(customerId) {
    const user = await this.db.User.findByPk(customerId, {
      attributes: { exclude: ["password", "resetToken", "resetTokenExpiry", "verificationToken"] },
    });
    if (!user) throw this.context.errorManager.getError("NOT_FOUND", "Customer not found");

    const addresses = await this.db.UserAddress.findAll({
      where: { userId: customerId },
      order: [["isDefault", "DESC"], ["createdAt", "DESC"]],
    });

    const orders = await this.db.Order.findAll({
      where: { userId: customerId },
      include: [{ model: this.db.OrderItem, as: "items" }],
      order: [["createdAt", "DESC"]],
    });

    const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    return {
      customer: user,
      addresses,
      orders,
      stats: {
        totalOrders: orders.length,
        totalSpent: +totalSpent.toFixed(2),
      },
    };
  }

  async lookupArticle(articleNo) {
    // Check if already in inventory
    const existing = await this.db.InventoryItem.findOne({
      where: { ridexArticleNo: articleNo },
    });
    if (existing) {
      throw this.context.errorManager.getError("BAD_REQUEST", "This article is already in your inventory");
    }

    // Fetch from RIDEX API
    const ridexService = (await import("./ridex.js")).default;
    let v1 = null;
    let v2 = null;
    try {
      const [v1Result, v2Result] = await Promise.all([
        ridexService.getArticles([articleNo]),
        ridexService.getArticleInfo([articleNo]),
      ]);
      v1 = v1Result?.[0] || null;
      v2 = v2Result?.[0] || null;
    } catch {
      throw this.context.errorManager.getError("BAD_REQUEST", "Could not fetch article from RIDEX. Check the article number.");
    }

    if (!v1 && !v2) {
      throw this.context.errorManager.getError("NOT_FOUND", "Article not found in RIDEX");
    }

    const name = (v2?.productName || v1?.Name || "").replace(/\bRIDEX\b\s*/gi, "");
    const oem = v2?.referenceNumbers?.OEM || [];
    const photos = (v2?.photos && v2.photos !== "no results")
      ? v2.photos.filter((url) => !url.includes("media.autodoc.de"))
      : [];
    const ridexPrice = v1?.Price ? parseFloat(v1.Price) : null;

    return {
      articleNo: v1?.ArticleNo || articleNo,
      name,
      ridexPrice,
      quantity: v1?.Quantity ?? null,
      oem,
      image: photos[0] || (v1?.ArticleId ? `https://cdn.ridex.de/thumb?m=4&n=0&id=${v1.ArticleId}&lng=en&typ=custom&cc=1` : null),
      photos,
      specs: v2?.technicalSpecifications || {},
    };
  }

  async createInventoryItem(data) {
    if (!data.ridexArticleNo) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Article number is required");
    }

    const existing = await this.db.InventoryItem.findOne({
      where: { ridexArticleNo: data.ridexArticleNo },
    });
    if (existing) {
      throw this.context.errorManager.getError("BAD_REQUEST", "This article is already in your inventory");
    }

    const item = await this.db.InventoryItem.create({
      ridexArticleNo: data.ridexArticleNo,
      partName: data.partName || null,
      oePartNo: data.oePartNo || null,
      customPrice: data.customPrice || null,
      customStock: data.customStock || 0,
      imageUrl: data.imageUrl || null,
      isActive: true,
    });

    // Ensure a product row exists so this item appears in catalog & search
    let product = await this.db.Product.findOne({
      where: { articleNo: data.ridexArticleNo },
    });
    if (!product) {
      product = await this.db.Product.create({
        articleNo: data.ridexArticleNo,
        articleId: data.articleId || null,
        name: data.partName || data.ridexArticleNo,
        brand: "RIDEX",
        ridexCategorySlug: data.category || null,
        ean: data.ean || null,
        isActive: true,
      });
      // Add image
      if (data.imageUrl) {
        await this.db.ProductImage.create({
          productId: product.id,
          url: data.imageUrl,
          isPrimary: true,
          sortOrder: 0,
        });
      }
    }

    // Add vehicle fitment if provided
    if (data.vehicleEngineIds && data.vehicleEngineIds.length > 0) {
      const existing = await this.db.ProductVehicle.findAll({
        where: { productId: product.id },
        attributes: ["vehicleEngineId"],
      });
      const existingSet = new Set(existing.map((pv) => pv.vehicleEngineId));

      const newFitments = data.vehicleEngineIds
        .filter((eid) => !existingSet.has(eid))
        .map((eid) => ({
          productId: product.id,
          vehicleEngineId: eid,
        }));

      if (newFitments.length > 0) {
        await this.db.ProductVehicle.bulkCreate(newFitments);
      }
    }

    return item;
  }

  async getProducts(page = 1, limit = 50, search = "") {
    const offset = (page - 1) * limit;
    const where = { isActive: true };

    if (search) {
      where[this.db.Sequelize.Op.or] = [
        { name: { [this.db.Sequelize.Op.iLike]: `%${search}%` } },
        { articleNo: { [this.db.Sequelize.Op.iLike]: `%${search}%` } },
        { ridexCategorySlug: { [this.db.Sequelize.Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await this.db.Product.findAndCountAll({
      where,
      include: [
        { model: this.db.ProductImage, as: "images", where: { isPrimary: true }, required: false, attributes: ["url"] },
      ],
      attributes: ["id", "articleNo", "articleId", "name", "brand", "ridexPrice", "ridexQuantity", "ridexCategorySlug", "ean", "isActive", "createdAt"],
      order: [["name", "ASC"]],
      limit,
      offset,
      distinct: true,
    });

    return {
      products: rows.map((p) => ({
        id: p.id,
        articleNo: p.articleNo,
        articleId: p.articleId,
        name: p.name,
        brand: p.brand,
        ridexPrice: p.ridexPrice ? parseFloat(p.ridexPrice) : null,
        ridexQuantity: p.ridexQuantity,
        category: p.ridexCategorySlug || null,
        ean: p.ean,
        image: p.images?.[0]?.url || null,
        isActive: p.isActive,
      })),
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getInventory() {
    return this.db.InventoryItem.findAll({
      where: { isActive: true },
      order: [["updatedAt", "DESC"]],
    });
  }

  async uploadInventory(rows) {
    // Flexible column name mapping (handles various Excel formats)
    const warnings = [];
    const items = rows.map((row, idx) => {
      const articleNo = row["Article No"] || row["ArticleNo"] || row["ridexArticleNo"] || row["article_no"] || row["RIDEX Article No"] || "";
      if (!articleNo) return null;

      const oePartNo = row["OE Part No"] || row["oePartNo"] || row["OE_Part_No"] || row["oe_part_no"] || null;

      // Validate OEM part number format if provided
      if (oePartNo) {
        const parts = String(oePartNo).split(/[\/,]/).map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          if (part.length < 4) {
            warnings.push(`Row ${idx + 2}: OE Part No "${part}" is suspiciously short (< 4 chars)`);
          }
          if (/\s{2,}/.test(part)) {
            warnings.push(`Row ${idx + 2}: OE Part No "${part}" contains extra spaces`);
          }
        }
      }

      return {
        ridexArticleNo: String(articleNo).trim(),
        oePartNo: oePartNo ? String(oePartNo).trim() : null,
        partName: row["Part Name"] || row["partName"] || row["Name"] || row["name"] || null,
        customPrice: row["Price"] || row["Custom Price"] || row["customPrice"] || row["custom_price"] || null,
        customStock: row["Stock"] || row["Custom Stock"] || row["customStock"] || row["custom_stock"] || 0,
        imageUrl: row["Image URL"] || row["imageUrl"] || row["image_url"] || null,
        category: row["Category"] || row["category"] || null,
        minQty: row["Min Qty"] || row["minQty"] || row["min_qty"] || 1,
        notes: row["Notes"] || row["notes"] || null,
      };
    }).filter(Boolean);

    if (items.length === 0) {
      throw this.context.errorManager.getError("BAD_REQUEST", "No valid rows found. Ensure 'Article No' column exists.");
    }

    const result = await this.db.InventoryItem.bulkCreate(items, {
      updateOnDuplicate: ["oePartNo", "partName", "customPrice", "customStock", "imageUrl", "category", "minQty", "notes", "updatedAt"],
    });

    return { uploaded: result.length, warnings };
  }

  getTemplate() {
    return {
      columns: ["Article No", "OE Part No", "Part Name", "Price", "Stock", "Category", "Image URL", "Min Qty", "Notes"],
      example: [
        { "Article No": "7O0084", "OE Part No": "LR019618", "Part Name": "Front Brake Pad Set", "Price": 24.99, "Stock": 10, "Category": "Brakes", "Image URL": "", "Min Qty": 2, "Notes": "" },
        { "Article No": "9F0233", "OE Part No": "LR010075", "Part Name": "Fuel Filter TDV6", "Price": 12.50, "Stock": 20, "Category": "Filters", "Image URL": "", "Min Qty": 5, "Notes": "" },
      ],
    };
  }

  async updateInventoryItem(id, data) {
    const item = await this.db.InventoryItem.findByPk(id);
    if (!item) {
      throw this.context.errorManager.getError("NOT_FOUND", "Inventory item not found");
    }

    const allowedFields = ["customPrice", "customStock", "imageUrl", "priority", "minQty", "notes", "oePartNo", "ridexArticleNo", "partName"];
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        item[key] = data[key];
      }
    }

    await item.save();
    return item;
  }

  async deleteInventoryItem(id) {
    const item = await this.db.InventoryItem.findByPk(id);
    if (!item) {
      throw this.context.errorManager.getError("NOT_FOUND", "Inventory item not found");
    }
    await item.destroy();
    return { deleted: true };
  }

  async getSettings() {
    const settings = await this.db.Setting.findAll();
    const result = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async updateSettings(data) {
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
      await this.db.Setting.upsert({ key, value });
    }
    await cache.del("app:settings");
    return this.getSettings();
  }

  async getSyncLogs(limit = 50) {
    const logs = await this.db.SyncLog.findAll({
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });
    return logs;
  }

  async refreshCategories() {
    const log = await this.db.SyncLog.create({
      type: "categories",
      status: "running",
      startedAt: new Date(),
    });

    try {
      const ridexScraper = (await import("./ridexScraper.js")).default;
      // Scrape categories for Land Rover (maker 1820) using a common model to discover categories
      const makeId = "1820";
      const html = await ridexScraper.fetchPage(`https://en.ridex.eu/catalog?maker=${makeId}`);

      // Extract parent category slugs and names
      const catRegex = /href="https:\/\/en\.ridex\.eu\/catalog\/([^"?/]+)\?[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/g;
      const parentCats = new Map();
      let m;
      while ((m = catRegex.exec(html)) !== null) {
        const slug = m[1].replace(/\/$/, "").trim();
        const name = m[2].trim();
        if (slug.length > 1 && !slug.includes(".") && name && !parentCats.has(slug)) {
          parentCats.set(slug, name);
        }
      }

      // Also try extracting from list items with cleaner pattern
      const listRegex = /catalog\/([^"?/]+)\?[^"]*"[^>]*title="([^"]+)"/g;
      while ((m = listRegex.exec(html)) !== null) {
        const slug = m[1].replace(/\/$/, "").trim();
        const name = m[2].trim();
        if (slug.length > 1 && !slug.includes(".") && !parentCats.has(slug)) {
          parentCats.set(slug, name);
        }
      }

      let processed = 0;
      const errors = [];

      // Upsert parent categories
      for (const [slug, name] of parentCats) {
        try {
          const cleanName = name.replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();
          if (!cleanName) continue;
          await this.db.Category.upsert({
            slug,
            name: cleanName,
            parentId: null,
            sortOrder: processed,
          });
          processed++;
        } catch (err) {
          errors.push(`Category "${slug}": ${err.message}`);
        }
      }

      // For each parent, scrape subcategories
      for (const [parentSlug] of parentCats) {
        try {
          const subHtml = await ridexScraper.fetchPage(`https://en.ridex.eu/catalog/${parentSlug}?maker=${makeId}`);
          const subRegex = /href="https:\/\/en\.ridex\.eu\/catalog\/([^"?]+)\?[^"]*"/g;
          let sm;
          while ((sm = subRegex.exec(subHtml)) !== null) {
            const fullSlug = sm[1].replace(/\/$/, "");
            if (fullSlug.includes("/") && fullSlug.startsWith(parentSlug + "/")) {
              const childSlug = fullSlug;
              // Extract name from nearby text
              const nameIdx = subHtml.indexOf(sm[0]);
              const nameArea = subHtml.substring(nameIdx, nameIdx + 300);
              const nameMatch = nameArea.match(/title="([^"]+)"/) || nameArea.match(/>([^<]{3,})</);
              const childName = nameMatch
                ? nameMatch[1].replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim()
                : childSlug.split("/").pop().replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

              // Find parent DB record
              const parentRecord = await this.db.Category.findOne({ where: { slug: parentSlug } });
              if (parentRecord) {
                try {
                  await this.db.Category.upsert({
                    slug: childSlug,
                    name: childName,
                    parentId: parentRecord.id,
                  });
                  processed++;
                } catch (err) {
                  errors.push(`Subcategory "${childSlug}": ${err.message}`);
                }
              }
            }
          }
        } catch {
          // Skip failed parent
        }
      }

      await log.update({
        status: "completed",
        itemsProcessed: processed,
        errors: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      });

      return { message: `Category sync completed. ${processed} categories processed.`, processed, errors };
    } catch (err) {
      await log.update({
        status: "failed",
        errors: [err.message],
        completedAt: new Date(),
      });
      throw this.context.errorManager.getError("INTERNAL", `Category sync failed: ${err.message}`);
    }
  }

  async refreshModels() {
    const log = await this.db.SyncLog.create({
      type: "models",
      status: "running",
      startedAt: new Date(),
    });

    try {
      const ridexScraper = (await import("./ridexScraper.js")).default;
      const makeId = "1820";

      // Scrape model listing from RIDEX
      const html = await ridexScraper.fetchPage(`https://en.ridex.eu/catalog?maker=${makeId}`);

      // Extract model options: <option value="modelId">Model Name</option>
      const modelRegex = /<option[^>]*value="(\d+)"[^>]*>([^<]+)<\/option>/g;
      const models = [];
      let m;
      while ((m = modelRegex.exec(html)) !== null) {
        const ridexId = m[1];
        const name = m[2].trim();
        if (ridexId && name && !models.some((x) => x.ridexId === ridexId)) {
          models.push({ ridexId, name });
        }
      }

      let processed = 0;
      const errors = [];

      for (const model of models) {
        try {
          const slug = model.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .substring(0, 100);

          // Parse year range from name like "(08.1990 - 02.2016)"
          const yearMatch = model.name.match(/\((\d{2})\.(\d{4})\s*-\s*(?:(\d{2})\.(\d{4})|\.\.\.)\)/);
          const yearFrom = yearMatch ? parseInt(yearMatch[2]) : null;
          const yearTo = yearMatch && yearMatch[4] ? parseInt(yearMatch[4]) : null;

          // Upsert by ridexId
          const existing = await this.db.VehicleModel.findOne({ where: { ridexId: model.ridexId } });
          if (existing) {
            await existing.update({ name: model.name, yearFrom, yearTo });
          } else {
            await this.db.VehicleModel.create({
              ridexId: model.ridexId,
              name: model.name,
              slug: `${slug}-${model.ridexId}`,
              yearFrom,
              yearTo,
            });
          }
          processed++;

          // Scrape engines for this model
          try {
            const modelHtml = await ridexScraper.fetchPage(`https://en.ridex.eu/catalog?maker=${makeId}&model=${model.ridexId}`);
            const engineRegex = /<option[^>]*value="(\d+)"[^>]*>([^<]+)<\/option>/g;
            const engineOptions = [];
            let em;
            // Find the car/engine select options (they appear after the model select)
            const carSection = modelHtml.split("car").slice(1).join("car");
            while ((em = engineRegex.exec(carSection)) !== null) {
              const eid = em[1];
              const ename = em[2].trim();
              if (eid && ename && !engineOptions.some((x) => x.ridexId === eid)) {
                engineOptions.push({ ridexId: eid, name: ename });
              }
            }

            const dbModel = await this.db.VehicleModel.findOne({ where: { ridexId: model.ridexId } });
            if (dbModel && engineOptions.length > 0) {
              for (const eng of engineOptions) {
                const existingEng = await this.db.VehicleEngine.findOne({
                  where: { vehicleModelId: dbModel.id, ridexId: eng.ridexId },
                });

                // Parse displacement and power from name
                const ccMatch = eng.name.match(/(\d{3,5})\s*ccm/i);
                const psMatch = eng.name.match(/(\d+)\s*PS/i);
                const displacement = ccMatch ? parseInt(ccMatch[1]) : null;
                const power = psMatch ? parseInt(psMatch[1]) : null;
                const fuelType = /diesel|td|sd/i.test(eng.name) ? "Diesel" : /hybrid|phev/i.test(eng.name) ? "Hybrid" : "Petrol";

                if (existingEng) {
                  await existingEng.update({ name: eng.name, displacement, power, fuelType });
                } else {
                  await this.db.VehicleEngine.create({
                    vehicleModelId: dbModel.id,
                    ridexId: eng.ridexId,
                    name: eng.name,
                    displacement,
                    power,
                    fuelType,
                  });
                }
                processed++;
              }
            }
          } catch (engErr) {
            errors.push(`Engines for model ${model.ridexId}: ${engErr.message}`);
          }
        } catch (err) {
          errors.push(`Model "${model.name}": ${err.message}`);
        }
      }

      await log.update({
        status: "completed",
        itemsProcessed: processed,
        errors: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      });

      return { message: `Model sync completed. ${processed} models+engines processed.`, processed, errors };
    } catch (err) {
      await log.update({
        status: "failed",
        errors: [err.message],
        completedAt: new Date(),
      });
      throw this.context.errorManager.getError("INTERNAL", `Model sync failed: ${err.message}`);
    }
  }
}

export default AdminService;
