import VehicleService from "../services/vehicle.js";

class VehicleController {
  constructor(context) {
    this.context = context;
    this.req = context.req;
    this.vehicleService = new VehicleService(context);
  }

  async getMakes() { return this.vehicleService.getMakes(); }

  async getModels() {
    const { makeId } = this.req.query;
    return this.vehicleService.getModels(makeId);
  }

  async getEngines() {
    const { makeId, modelId } = this.req.query;
    return this.vehicleService.getEngines(modelId);
  }

  async regLookup() {
    const { vrm } = this.req.body;
    if (!vrm) throw this.context.errorManager.getError("BAD_REQUEST", "Registration number required");
    return this.vehicleService.regLookup(vrm);
  }

  async getGarage() { return this.vehicleService.getGarage(this.req.user.id); }

  async addToGarage() { return this.vehicleService.addToGarage(this.req.user.id, this.req.body); }

  async removeFromGarage() { return this.vehicleService.removeFromGarage(this.req.user.id, this.req.params.id); }
}
export default VehicleController;
