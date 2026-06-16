import AdminController from "../src/controllers/AdminController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { upload } from "../middlewares/upload.js";

const Routes = [
  { path: "/admin/dashboard", method: "GET", controller: AdminController, action: "dashboard", middlewares: [authenticate] },
  { path: "/admin/orders", method: "GET", controller: AdminController, action: "orders", middlewares: [authenticate] },
  { path: "/admin/orders/:id", method: "GET", controller: AdminController, action: "orderDetail", middlewares: [authenticate] },
  { path: "/admin/orders/:id/stripe", method: "GET", controller: AdminController, action: "orderStripeDetails", middlewares: [authenticate] },
  { path: "/admin/orders/:id", method: "PATCH", controller: AdminController, action: "updateOrderStatus", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/customers", method: "GET", controller: AdminController, action: "customers", middlewares: [authenticate] },
  { path: "/admin/customers/:id", method: "GET", controller: AdminController, action: "customerDetail", middlewares: [authenticate] },
  { path: "/admin/products", method: "GET", controller: AdminController, action: "products", middlewares: [authenticate] },
  { path: "/admin/inventory/lookup/:articleNo", method: "GET", controller: AdminController, action: "lookupArticle", middlewares: [authenticate] },
  { path: "/admin/inventory/create", method: "POST", controller: AdminController, action: "createInventoryItem", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/inventory", method: "GET", controller: AdminController, action: "inventory", middlewares: [authenticate] },
  { path: "/admin/inventory/template", method: "GET", controller: AdminController, action: "downloadTemplate", middlewares: [authenticate] },
  { path: "/admin/inventory/upload", method: "POST", controller: AdminController, action: "uploadInventory", middlewares: [authenticate, upload.single("file")] },
  { path: "/admin/inventory/:id", method: "PATCH", controller: AdminController, action: "updateInventoryItem", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/inventory/:id", method: "DELETE", controller: AdminController, action: "deleteInventoryItem", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/settings", method: "GET", controller: AdminController, action: "settings", middlewares: [authenticate] },
  { path: "/admin/settings", method: "PUT", controller: AdminController, action: "updateSettings", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/messages", method: "GET", controller: AdminController, action: "getMessages", middlewares: [authenticate] },
  { path: "/admin/messages/:id", method: "PATCH", controller: AdminController, action: "updateMessage", middlewares: [authenticate] },
  { path: "/admin/sync/logs", method: "GET", controller: AdminController, action: "syncLogs", middlewares: [authenticate] },
  { path: "/admin/sync/refresh-categories", method: "POST", controller: AdminController, action: "refreshCategories", middlewares: [authenticate] },
  { path: "/admin/sync/refresh-models", method: "POST", controller: AdminController, action: "refreshModels", middlewares: [authenticate] },
];

export default Routes;
