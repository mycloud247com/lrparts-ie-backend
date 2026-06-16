import OrderController from "../src/controllers/OrderController.js";
import { authenticate } from "../middlewares/authenticate.js";

const Routes = [
  { path: "/orders/track", method: "POST", controller: OrderController, action: "trackOrder", middlewares: [] },
  { path: "/orders", method: "GET", controller: OrderController, action: "list", middlewares: [authenticate] },
  { path: "/orders/:orderNumber/cancel", method: "POST", controller: OrderController, action: "cancelOrder", middlewares: [authenticate] },
  { path: "/orders/:orderNumber/checkout-url", method: "GET", controller: OrderController, action: "getCheckoutUrl", middlewares: [authenticate] },
  { path: "/orders/by-session", method: "GET", controller: OrderController, action: "getBySessionId", middlewares: [authenticate] },
  { path: "/orders/:orderNumber", method: "GET", controller: OrderController, action: "getByNumber", middlewares: [authenticate] },
];

export default Routes;
