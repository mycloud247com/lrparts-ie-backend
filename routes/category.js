import CategoryController from "../src/controllers/CategoryController.js";

const Routes = [
  { path: "/categories", method: "GET", controller: CategoryController, action: "getTree", middlewares: [] },
  { path: "/categories/:slug", method: "GET", controller: CategoryController, action: "getBySlug", middlewares: [] },
];
export default Routes;
