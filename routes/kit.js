import KitController from "../src/controllers/KitController.js";
import { authenticate } from "../middlewares/authenticate.js";

const Routes = [
  // Public
  { path: "/kits", method: "GET", controller: KitController, action: "list" },
  { path: "/kits/vehicle", method: "GET", controller: KitController, action: "byVehicle" },
  { path: "/kits/:slug", method: "GET", controller: KitController, action: "detail" },

  // Admin
  { path: "/admin/kits", method: "GET", controller: KitController, action: "adminList", middlewares: [authenticate] },
  { path: "/admin/kits", method: "POST", controller: KitController, action: "adminCreate", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/kits/:id", method: "PUT", controller: KitController, action: "adminUpdate", middlewares: [authenticate], autoCommit: true },
  { path: "/admin/kits/:id", method: "DELETE", controller: KitController, action: "adminDelete", middlewares: [authenticate] },
  { path: "/admin/kits/:id/items", method: "PUT", controller: KitController, action: "adminUpdateItems", middlewares: [authenticate], autoCommit: true },
];

export default Routes;
