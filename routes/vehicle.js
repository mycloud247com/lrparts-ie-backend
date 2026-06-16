import VehicleController from "../src/controllers/VehicleController.js";
import { authenticate } from "../middlewares/authenticate.js";

const Routes = [
  // Demo-matching flow: Make → Model → Engine
  { path: "/makes", method: "GET", controller: VehicleController, action: "getMakes", middlewares: [] },
  { path: "/models", method: "GET", controller: VehicleController, action: "getModels", middlewares: [] },
  { path: "/engines", method: "GET", controller: VehicleController, action: "getEngines", middlewares: [] },
  { path: "/motorcheck/lookup", method: "POST", controller: VehicleController, action: "regLookup", middlewares: [] },
  // Garage
  { path: "/garage", method: "GET", controller: VehicleController, action: "getGarage", middlewares: [authenticate] },
  { path: "/garage", method: "POST", controller: VehicleController, action: "addToGarage", middlewares: [authenticate], autoCommit: true },
  { path: "/garage/:id", method: "DELETE", controller: VehicleController, action: "removeFromGarage", middlewares: [authenticate], autoCommit: true },
];

export default Routes;
