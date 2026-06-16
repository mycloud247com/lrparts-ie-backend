import KitService from "../services/kit.js";

class KitController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.res = context.res;
    this.kitService = new KitService(context);
  }

  checkAdmin() {
    if (!this.req.user || this.req.user.role !== "admin") {
      throw this.context.errorManager.getError("FORBIDDEN");
    }
  }

  // ─── Public ───────────────────────────────────────────────────

  async list() {
    return this.kitService.getAll();
  }

  async detail() {
    return this.kitService.getBySlug(this.req.params.slug);
  }

  async byVehicle() {
    const { model, car } = this.req.query;
    return this.kitService.getByVehicle(model || null, car || null);
  }

  // ─── Admin ────────────────────────────────────────────────────

  async adminList() {
    this.checkAdmin();
    return this.kitService.adminGetAll();
  }

  async adminCreate() {
    this.checkAdmin();
    return this.kitService.create(this.req.body);
  }

  async adminUpdate() {
    this.checkAdmin();
    return this.kitService.update(this.req.params.id, this.req.body);
  }

  async adminDelete() {
    this.checkAdmin();
    return this.kitService.delete(this.req.params.id);
  }

  async adminUpdateItems() {
    this.checkAdmin();
    return this.kitService.updateItems(this.req.params.id, this.req.body.items);
  }
}

export default KitController;
