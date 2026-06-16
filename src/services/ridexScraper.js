import axios from "axios";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

class RidexScraperService {
  async fetchPage(url) {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    return res.data;
  }

  // Parse products from RIDEX catalog HTML
  parseProducts(html) {
    const products = [];
    const items = html.split('class="listing-list__item ');
    items.shift();
    for (const item of items) {
      try {
        const priceMatch = item.match(/data-item-price="([^"]*)"/);
        const qtyMatch = item.match(/data-item-qty="([^"]*)"/);
        const hrefMatch = item.match(/href="([^"]*\/product\/\d+)"/);
        const imgMatch = item.match(/src="(https:\/\/media[^"]+)"/) || item.match(/data-srcset="(https:\/\/media[^"]+)"/) || item.match(/data-src="(https:\/\/[^"]+\.(?:jpg|png|webp)[^"]*)"/);
        const articleIdMatch = item.match(/data-articleId="(\d+)"/);
        const articleNoMatch = item.match(/data-articleId="\d+"[^>]*>\s*(\S+)\s*<\/a>/);
        const titleMatch = item.match(/class="title"[^>]*>\s*([^<]+?)\s*<\/a>/);
        const descMatch = item.match(/class="description">([\s\S]*?)<\/div>/);
        if (!hrefMatch) continue;
        const specs = {};
        if (descMatch) {
          const specRegex = /([^<:]+):\s*<b>([^<]+)<\/b>/g;
          let sMatch;
          while ((sMatch = specRegex.exec(descMatch[1])) !== null) {
            specs[sMatch[1].trim()] = sMatch[2].trim().replace(/,$/, "");
          }
        }
        // Prefer cdn.ridex.de thumb URL over media.autodoc.de (which blocks hotlinking)
        const articleId = articleIdMatch ? articleIdMatch[1] : "";
        let image = "";
        if (articleId) {
          image = `https://cdn.ridex.de/thumb?m=4&n=0&id=${articleId}&lng=en&typ=custom&cc=1`;
        } else if (imgMatch && !imgMatch[1].includes("media.autodoc.de")) {
          image = imgMatch[1];
        }

        products.push({
          articleId,
          articleNo: articleNoMatch ? articleNoMatch[1].trim() : "",
          name: titleMatch ? titleMatch[1].trim().replace(/\bRIDEX\b\s*/gi, "") : "",
          url: hrefMatch[1],
          image,
          price: priceMatch ? priceMatch[1] : null,
          qty: qtyMatch ? qtyMatch[1] : null,
          specs,
        });
      } catch { /* skip malformed */ }
    }
    return products;
  }

  // Build vehicle query string
  vehicleQuery(maker, model, car) {
    let q = `maker=${maker}`;
    if (model) q += `&model=${model}`;
    if (car) q += `&car=${car}`;
    return q;
  }

  // Get vehicle-specific categories from RIDEX.
  // ONLY uses links that RIDEX tagged with vehicle query params (maker/model/car).
  // Plain navigation links are ignored — they are generic site nav, not vehicle-filtered.
  async getAllLeafCategories(maker, model, car) {
    const vq = this.vehicleQuery(maker, model, car);
    const mainHtml = await this.fetchPage(`https://en.ridex.eu/catalog?${vq}`);
    const leafs = [];
    const seen = new Set();
    // Only match links that contain vehicle params — these are the categories
    // RIDEX confirms have products for this specific vehicle
    const paramRegex = /href="https:\/\/en\.ridex\.eu\/catalog\/([^"?]+)\?[^"]*maker=\d+[^"]*"/g;
    let m;
    while ((m = paramRegex.exec(mainHtml)) !== null) {
      const slug = m[1].replace(/\/$/, "");
      if (slug.includes("/") && !seen.has(slug)) {
        seen.add(slug);
        leafs.push(slug);
      }
    }
    console.log(`[RIDEX] Vehicle ${maker}/${model}/${car}: ${leafs.length} categories:`, leafs);
    return leafs;
  }

  // Check if a product is compatible with a specific model (e.g. "Discovery III (L319)")
  // Checks the product page's compatibility section for the model name
  async isCompatibleWith(articleId, modelName) {
    try {
      const html = await this.fetchPage(`https://en.ridex.eu/product/${articleId}`);
      const compStart = html.indexOf("car-compatibility");
      if (compStart === -1) return false;
      const compSection = html.substring(compStart);
      // Match by model name (e.g. "Discovery III (L319)" appears in
      // "LAND ROVER Discovery III (L319) (Year of Construction ...)")
      return compSection.includes(modelName);
    } catch { return false; }
  }

  // Run promises with concurrency limit
  async withConcurrency(tasks, limit) {
    const results = [];
    const executing = new Set();
    for (const task of tasks) {
      const p = task().then((r) => { executing.delete(p); return r; });
      executing.add(p);
      results.push(p);
      if (executing.size >= limit) await Promise.race(executing);
    }
    return Promise.all(results);
  }

  // Fetch all products for a vehicle across all categories
  // Tags each product with its RIDEX category slug
  // Filters to only products compatible with the selected make
  async getProductsForVehicle(maker, model, car, modelName) {
    const vq = this.vehicleQuery(maker, model, car);
    console.log(`[RIDEX] Scraping vehicle: maker=${maker} model=${model} car=${car}`);
    const categories = await this.getAllLeafCategories(maker, model, car);
    console.log(`[RIDEX] Found ${categories.length} categories:`, categories);
    const results = await Promise.all(
      categories.map(async (cat) => {
        try {
          const url = `https://en.ridex.eu/catalog/${cat}?${vq}`;
          const html = await this.fetchPage(url);
          const products = this.parseProducts(html);
          console.log(`[RIDEX] ${cat}: ${products.length} products from ${url}`);
          const parentCat = cat.includes("/") ? cat.split("/")[0] : cat;
          for (const p of products) {
            p.category = parentCat;
            p.subcategory = cat;
          }
          return products;
        } catch { return []; }
      })
    );
    const seen = new Set();
    let allProducts = [];
    for (const batch of results) {
      for (const p of batch) {
        if (p.articleNo && !seen.has(p.articleNo)) { seen.add(p.articleNo); allProducts.push(p); }
      }
    }

    // Filter: check each product's compatibility page for the specific model
    const checkName = modelName || "LAND ROVER";
    console.log(`[RIDEX] Checking compatibility for ${allProducts.length} products against "${checkName}"...`);
    const compatChecks = allProducts.map((p) => async () => {
      if (!p.articleId) return false;
      return this.isCompatibleWith(p.articleId, checkName);
    });
    const compatible = await this.withConcurrency(compatChecks, 15);
    const filtered = allProducts.filter((_, i) => compatible[i]);
    console.log(`[RIDEX] ${filtered.length}/${allProducts.length} products are compatible with "${checkName}"`);

    return { products: filtered, categoryCount: categories.length };
  }

  // Get max page number from HTML pagination block
  getMaxPage(html) {
    const paginationMatch = html.match(/class="pagination[\s\S]*?<\/ul>/);
    if (!paginationMatch) return 1;
    const pages = paginationMatch[0].match(/page=(\d+)/g);
    if (!pages) return 1;
    return Math.max(...pages.map((p) => parseInt(p.match(/\d+/)[0])));
  }

  // Full scrape: fetch ALL pages for a category, not just page 1
  async fetchAllPagesForCategory(baseUrl, delayMs = 1500) {
    const html1 = await this.fetchPage(baseUrl);
    const page1Products = this.parseProducts(html1);
    const maxPage = this.getMaxPage(html1);

    if (maxPage <= 1) return page1Products;

    const allProducts = [...page1Products];
    for (let page = 2; page <= maxPage; page++) {
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        const sep = baseUrl.includes("?") ? "&" : "?";
        const html = await this.fetchPage(`${baseUrl}${sep}page=${page}`);
        const products = this.parseProducts(html);
        if (products.length === 0) break; // no more products
        allProducts.push(...products);
      } catch { break; }
    }
    return allProducts;
  }

  // Full scrape version: like getProductsForVehicle but with pagination
  async getProductsForVehicleFull(maker, model, car, modelName, pageDelayMs = 1500) {
    const vq = this.vehicleQuery(maker, model, car);
    console.log(`[RIDEX] Full scraping vehicle: maker=${maker} model=${model} car=${car}`);
    const categories = await this.getAllLeafCategories(maker, model, car);
    console.log(`[RIDEX] Found ${categories.length} categories`);

    // Fetch ALL pages per category (sequentially to avoid IP ban)
    const allProducts = [];
    const seen = new Set();

    for (const cat of categories) {
      try {
        const url = `https://en.ridex.eu/catalog/${cat}?${vq}`;
        const products = await this.fetchAllPagesForCategory(url, pageDelayMs);
        const parentCat = cat.includes("/") ? cat.split("/")[0] : cat;
        let catNew = 0;
        for (const p of products) {
          if (p.articleNo && !seen.has(p.articleNo)) {
            seen.add(p.articleNo);
            p.category = parentCat;
            p.subcategory = cat;
            allProducts.push(p);
            catNew++;
          }
        }
        console.log(`[RIDEX] ${cat}: ${products.length} total, ${catNew} new (${seen.size} unique so far)`);
      } catch (err) {
        console.warn(`[RIDEX] Failed ${cat}: ${err.message}`);
      }
    }

    // Filter: check each product's compatibility page
    const checkName = modelName || "LAND ROVER";
    console.log(`[RIDEX] Checking compatibility for ${allProducts.length} products against "${checkName}"...`);
    const compatChecks = allProducts.map((p) => async () => {
      if (!p.articleId) return false;
      return this.isCompatibleWith(p.articleId, checkName);
    });
    const compatible = await this.withConcurrency(compatChecks, 10);
    const filtered = allProducts.filter((_, i) => compatible[i]);
    console.log(`[RIDEX] ${filtered.length}/${allProducts.length} products compatible with "${checkName}"`);

    return { products: filtered, categoryCount: categories.length };
  }

  // Scrape compatible vehicles from a product page
  // Fetches the main page for model summaries, then AJAX endpoints for detailed engines
  async scrapeCompatibleVehicles(articleId) {
    try {
      const html = await this.fetchPage(`https://en.ridex.eu/product/${articleId}`);
      const compStart = html.indexOf("car-compatibility");
      if (compStart === -1) return [];
      const compSection = html.substring(compStart, compStart + 10000);

      // Extract make names (top-level)
      const makeNameRegex = /car-compatibility__model-name\s+_js-other-cars__name">\s*<span>([^<]+)<\/span>/g;
      const makes = [];
      let mm;
      while ((mm = makeNameRegex.exec(compSection)) !== null) {
        makes.push({ name: mm[1].trim(), index: mm.index });
      }

      // Extract model items with their AJAX data-url for engine details
      const modelRegex = /car-compatibility__model-name--child\s+_js-other-cars__name"\s+data-url="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>/g;
      const modelItems = [];
      let mi;
      while ((mi = modelRegex.exec(compSection)) !== null) {
        modelItems.push({ url: mi[1].trim(), text: mi[2].trim(), index: mi.index });
      }

      // Group models under makes by position
      const vehicles = [];
      for (let i = 0; i < makes.length; i++) {
        const makeStart = makes[i].index;
        const makeEnd = i + 1 < makes.length ? makes[i + 1].index : Infinity;
        const modelsForMake = modelItems.filter((m) => m.index > makeStart && m.index < makeEnd);

        const modelGroups = [];
        // Fetch engine details for each model via AJAX
        for (const model of modelsForMake) {
          const engines = [];
          try {
            const res = await axios.get(model.url, { headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" }, timeout: 10000 });
            const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
            if (data.success && data.data) {
              const engineRegex = /<span>([^<]+)<\/span>/g;
              let em;
              while ((em = engineRegex.exec(data.data)) !== null) {
                engines.push(em[1].trim());
              }
            }
          } catch {}
          modelGroups.push({ summary: model.text, engines });
        }

        if (modelGroups.length > 0) vehicles.push({ make: makes[i].name, models: modelGroups });
      }
      return vehicles;
    } catch { return []; }
  }

  // Scrape Ridex search page
  async searchProducts(query) {
    try {
      const html = await this.fetchPage(`https://en.ridex.eu/search?q=${encodeURIComponent(query)}`);
      return this.parseProducts(html);
    } catch { return []; }
  }
}

export default new RidexScraperService();
