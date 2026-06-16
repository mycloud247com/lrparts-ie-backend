import ContactController from "../src/controllers/ContactController.js";

const Routes = [
  { path: "/contact", method: "POST", controller: ContactController, action: "submit", middlewares: [] },
];

export default Routes;
