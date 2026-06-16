import CheckoutController from "../src/controllers/CheckoutController.js";
import { authenticate } from "../middlewares/authenticate.js";

const Routes = [
  { path: "/checkout/create-session", method: "POST", controller: CheckoutController, action: "createSession", middlewares: [authenticate] },
  { path: "/checkout/webhook", method: "POST", controller: CheckoutController, action: "webhook", middlewares: [] },
];

export default Routes;
