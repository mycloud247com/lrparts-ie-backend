import ProductService from "../services/product.js";

class ProductController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.productService = new ProductService(context);
  }

  /**
   * GET /api/products?maker=1820&model=5160&car=11153
   * Returns products from the database, filtered by vehicle fitment.
   */
  async list() {
    const { maker, model, car, featured } = this.req.query;

    if (featured === "true") {
      return this.productService.getFeaturedProducts(parseInt(this.req.query.limit) || 8);
    }

    return this.productService.getProductsForVehicle(maker, model, car);
  }

  /**
   * GET /api/products/:articleNo
   * Fetches product detail from the database.
   */
  async getDetail() {
    const { articleNo } = this.req.params;
    const product = await this.productService.getProductDetail(articleNo);
    if (!product) {
      throw this.context.errorManager.getError("PRODUCT_NOT_FOUND");
    }
    if (!product.name) product.name = articleNo;
    return product;
  }

  /**
   * GET /api/search?q=brake+disc
   * Searches products in the database using full-text search.
   */
  async search() {
    const { q } = this.req.query;
    if (!q || q.trim().length < 2) {
      throw this.context.errorManager.getError("BAD_REQUEST", "Search query required (min 2 chars)");
    }
    return this.productService.search(q);
  }
}

export default ProductController;
