import AdminService from "../services/admin.js";
import xlsx from "xlsx";

class AdminController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.res = context.res;
    this.adminService = new AdminService(context);
  }

  checkAdmin() {
    if (!this.req.user || this.req.user.role !== "admin") {
      throw this.context.errorManager.getError("FORBIDDEN");
    }
  }

  async dashboard() {
    this.checkAdmin();
    return this.adminService.getDashboard();
  }

  async orders() {
    this.checkAdmin();
    return this.adminService.getOrders(
      this.req.query.page,
      this.req.query.limit,
      this.req.query.status
    );
  }

  async orderDetail() {
    this.checkAdmin();
    return this.adminService.getOrderDetail(this.req.params.id);
  }

  async orderStripeDetails() {
    this.checkAdmin();
    return this.adminService.getOrderStripeDetails(this.req.params.id);
  }

  async updateOrderStatus() {
    this.checkAdmin();
    const { status, note, trackingNumber, trackingUrl, carrier } = this.req.body;
    const tracking = (trackingNumber || trackingUrl || carrier)
      ? { trackingNumber, trackingUrl, carrier }
      : null;
    return this.adminService.updateOrderStatus(this.req.params.id, status, note, tracking);
  }

  async customers() {
    this.checkAdmin();
    return this.adminService.getCustomers(this.req.query.page, this.req.query.limit);
  }

  async customerDetail() {
    this.checkAdmin();
    return this.adminService.getCustomerDetail(this.req.params.id);
  }

  async lookupArticle() {
    this.checkAdmin();
    return this.adminService.lookupArticle(this.req.params.articleNo);
  }

  async createInventoryItem() {
    this.checkAdmin();
    return this.adminService.createInventoryItem(this.req.body);
  }

  async products() {
    this.checkAdmin();
    const { page, limit, search } = this.req.query;
    return this.adminService.getProducts(
      parseInt(page) || 1,
      parseInt(limit) || 50,
      search || ""
    );
  }

  async inventory() {
    this.checkAdmin();
    return this.adminService.getInventory();
  }

  async uploadInventory() {
    this.checkAdmin();
    const file = this.req.file;
    if (!file) {
      throw this.context.errorManager.getError("BAD_REQUEST", "No file uploaded");
    }
    const wb = xlsx.read(file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws);
    return this.adminService.uploadInventory(rows);
  }

  async downloadTemplate() {
    this.checkAdmin();
    const template = this.adminService.getTemplate();
    const ws = xlsx.utils.json_to_sheet(template.example, { header: template.columns });
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Inventory");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    this.res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    this.res.setHeader("Content-Disposition", "attachment; filename=inventory_template.xlsx");
    this.res.send(buffer);
  }

  async updateInventoryItem() {
    this.checkAdmin();
    return this.adminService.updateInventoryItem(this.req.params.id, this.req.body);
  }

  async deleteInventoryItem() {
    this.checkAdmin();
    return this.adminService.deleteInventoryItem(this.req.params.id);
  }

  async settings() {
    this.checkAdmin();
    return this.adminService.getSettings();
  }

  async updateSettings() {
    this.checkAdmin();
    return this.adminService.updateSettings(this.req.body);
  }

  async getMessages() {
    this.checkAdmin();
    const messages = await this.context.db.ContactMessage.findAll({
      order: [["createdAt", "DESC"]],
    });
    return messages;
  }

  async updateMessage() {
    this.checkAdmin();
    const { id } = this.req.params;
    const { status, adminNote } = this.req.body;
    const msg = await this.context.db.ContactMessage.findByPk(id);
    if (!msg) throw this.context.errorManager.getError("NOT_FOUND", "Message not found");
    if (status) msg.status = status;
    if (adminNote !== undefined) msg.adminNote = adminNote;
    await msg.save();
    return msg;
  }

  async syncLogs() {
    this.checkAdmin();
    return this.adminService.getSyncLogs();
  }

  async refreshCategories() {
    this.checkAdmin();
    return this.adminService.refreshCategories();
  }

  async refreshModels() {
    this.checkAdmin();
    return this.adminService.refreshModels();
  }
}

export default AdminController;
