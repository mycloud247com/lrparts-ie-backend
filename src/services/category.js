class CategoryService {
  constructor(context) {
    this.db = context.db;
  }

  async getTree() {
    return this.db.Category.findAll({
      where: { parentId: null },
      include: [{ model: this.db.Category, as: "children" }],
      order: [["sortOrder", "ASC"], ["name", "ASC"]],
    });
  }

  async getBySlug(slug) {
    return this.db.Category.findOne({
      where: { slug },
      include: [{ model: this.db.Category, as: "children" }],
    });
  }
}

export default CategoryService;
