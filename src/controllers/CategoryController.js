import CategoryService from "../services/category.js";

class CategoryController {
  constructor(context) {
    this.context = context;
    this.categoryService = new CategoryService(context);
  }

  async getTree() {
    return this.categoryService.getTree();
  }

  async getBySlug() {
    const cat = await this.categoryService.getBySlug(this.context.req.params.slug);
    if (!cat) throw this.context.errorManager.getError("NOT_FOUND");
    return cat;
  }
}

export default CategoryController;
