import ProductController from "../src/controllers/ProductController.js";

const Routes = [
  // GET /api/products?maker=1820&model=5160&car=11153
  { path: "/products", method: "GET", controller: ProductController, action: "list", middlewares: [] },
  // GET /api/products/:articleNo — product detail from RIDEX
  { path: "/products/:articleNo", method: "GET", controller: ProductController, action: "getDetail", middlewares: [] },
  // GET /api/search?q=LR019618 — search RIDEX
  { path: "/search", method: "GET", controller: ProductController, action: "search", middlewares: [] },
];

export default Routes;
