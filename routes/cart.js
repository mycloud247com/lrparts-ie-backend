import CartController from "../src/controllers/CartController.js";
import { authenticate } from "../middlewares/authenticate.js";

const Routes = [
  { path: "/cart", method: "GET", controller: CartController, action: "getCart", middlewares: [authenticate] },
  { path: "/cart/items", method: "POST", controller: CartController, action: "addItem", middlewares: [authenticate], autoCommit: true },
  { path: "/cart/kit", method: "POST", controller: CartController, action: "addKit", middlewares: [authenticate], autoCommit: true },
  { path: "/cart/items/:id", method: "PATCH", controller: CartController, action: "updateItem", middlewares: [authenticate], autoCommit: true },
  { path: "/cart/items/:id", method: "DELETE", controller: CartController, action: "removeItem", middlewares: [authenticate], autoCommit: true },
  { path: "/cart", method: "DELETE", controller: CartController, action: "clearCart", middlewares: [authenticate], autoCommit: true },
];

export default Routes;
