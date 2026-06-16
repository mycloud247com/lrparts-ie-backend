import { matchWithGroq } from "./groqMatcher.js";

class VehicleService {
  constructor(context) {
    this.db = context.db;
    this.errorManager = context.errorManager;
  }

  // Makes — hardcoded to Land Rover (ridexId: 1820)
  async getMakes() {
    return [{ id: "1820", name: "LAND ROVER" }];
  }

  // Models — returns ridexId so frontend can pass to products endpoint
  async getModels(makeId) {
    const models = await this.db.VehicleModel.findAll({
      attributes: ["id", "name", "slug", "ridexId", "yearFrom", "yearTo"],
      order: [["name", "ASC"]],
    });
    return models.map((m) => {
      const years = m.yearFrom ? ` (${m.yearFrom}–${m.yearTo || "present"})` : "";
      return {
        id: m.ridexId,
        name: `${m.name}${years}`,
        slug: m.slug,
        dbId: m.id,
      };
    });
  }

  // Engines — returns ridexId so frontend can pass as "car" param
  async getEngines(modelRidexId) {
    // Find model by ridexId
    const model = await this.db.VehicleModel.findOne({ where: { ridexId: modelRidexId } });
    if (!model) return [];

    const engines = await this.db.VehicleEngine.findAll({
      where: { vehicleModelId: model.id },
      attributes: ["id", "name", "ridexId", "displacement", "power", "fuelType"],
      order: [["name", "ASC"]],
    });
    // Build unique display names by appending power/displacement when names collide
    const nameCount = {};
    const namePowerCount = {};
    for (const e of engines) {
      nameCount[e.name] = (nameCount[e.name] || 0) + 1;
      const npKey = `${e.name}|${e.power}`;
      namePowerCount[npKey] = (namePowerCount[npKey] || 0) + 1;
    }

    // Build rich display names with CC, HP, fuel for every engine
    const seen = new Set();
    const deduped = [];
    for (const e of engines) {
      // Build details string
      const parts = [e.name];
      const details = [];
      if (e.displacement) details.push(`${e.displacement}cc`);
      if (e.power) details.push(`${e.power} HP`);
      if (e.fuelType) details.push(e.fuelType.charAt(0).toUpperCase() + e.fuelType.slice(1));
      const displayName = details.length > 0 ? `${e.name} · ${details.join(" · ")}` : e.name;

      // Skip true duplicates
      if (seen.has(displayName)) continue;
      seen.add(displayName);

      deduped.push({
        id: e.ridexId,
        name: displayName,
        displacement: e.displacement,
        power: e.power,
        fuelType: e.fuelType,
        dbId: e.id,
      });
    }

    return deduped;
  }

  // MotorCheck reg plate lookup
  async regLookup(vrm) {
    try {
      const pageRes = await fetch("https://www.motorcheck.ie/free-car-check/enter-reg/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
      });
      const setCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
      const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
      const pageHtml = await pageRes.text();
      const csrfMatch = pageHtml.match(/csrf-token"\s*content="([^"]+)"/);
      if (!csrfMatch) return { success: false, error: "Could not get CSRF token" };

      const lookupRes = await fetch("https://www.motorcheck.ie/ajax/free-lookup/", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": csrfMatch[1],
          Referer: "https://www.motorcheck.ie/free-car-check/enter-reg/",
          Accept: "application/json",
          Cookie: cookieHeader,
        },
        body: `_token=${csrfMatch[1]}&vrm=${encodeURIComponent(vrm.toUpperCase())}`,
      });
      const data = await lookupRes.json();
      if (data.success && data.vehicle) {
        const v = data.vehicle;
        const vehicle = {
          make: v.make, details: v.details, year: v.year,
          engineCC: v.engineCC, bhp: v.bhp, body: v.body,
          fuel: v.fuel, colour: v.colour, transmission: v.transmission,
        };

        // Match to our DB models/engines
        let match = null;
        try {
          match = await this.matchVehicle(
            v.details || "",
            v.engineCC ? parseInt(v.engineCC) : null,
            v.bhp ? parseInt(v.bhp) : null,
            v.fuel || "",
            v.year ? parseInt(v.year) : null,
          );
        } catch { /* matching failed, still return raw data */ }

        return { success: true, vrm: data.vrm, vehicle, match };
      }
      return { success: false, error: "Vehicle not found" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Match MotorCheck data to our vehicle_models + vehicle_engines.
   * 1. Check DB cache first
   * 2. Use Groq AI to match (sends full catalog)
   * 3. Save result to cache for instant future lookups
   */
  async matchVehicle(details, engineCC, bhp, fuel, year) {
    const pattern = (details || "").toLowerCase().trim();
    const fuelLower = (fuel || "").toLowerCase();
    const fuelNorm = fuelLower.includes("diesel") ? "diesel" : "petrol";

    // 1. Check cache
    if (this.db.MotorcheckMapping) {
      const cached = await this.db.MotorcheckMapping.findOne({
        where: { detailsPattern: pattern, engineCc: engineCC || null, fuel: fuelNorm },
        include: [
          { model: this.db.VehicleModel, as: "vehicleModel", attributes: ["ridexId", "name"] },
          { model: this.db.VehicleEngine, as: "vehicleEngine", attributes: ["ridexId", "name", "displacement", "power"] },
        ],
      });
      if (cached && cached.vehicleModel) {
        return {
          modelId: cached.vehicleModel.ridexId,
          modelName: cached.vehicleModel.name,
          engineId: cached.vehicleEngine?.ridexId || null,
          engineName: cached.vehicleEngine?.name || null,
          confidence: cached.confirmed ? 100 : 90,
          cached: true,
        };
      }
    }

    // 2. Use Groq AI to match
    const groqResult = await matchWithGroq(details, engineCC, bhp, fuel, year);
    if (!groqResult || !groqResult.modelId) return null;

    // Look up the model and engine in our DB to get full names
    const model = await this.db.VehicleModel.findOne({ where: { ridexId: String(groqResult.modelId) } });
    if (!model) return null;

    let engine = null;
    if (groqResult.engineId) {
      engine = await this.db.VehicleEngine.findOne({ where: { ridexId: String(groqResult.engineId) } });
    }

    // 3. Save to cache
    if (this.db.MotorcheckMapping) {
      try {
        await this.db.MotorcheckMapping.upsert({
          detailsPattern: pattern,
          engineCc: engineCC || null,
          fuel: fuelNorm,
          yearFrom: year || null,
          yearTo: year || null,
          vehicleModelId: model.id,
          vehicleEngineId: engine?.id || null,
          confirmed: false,
        });
      } catch { /* ignore */ }
    }

    return {
      modelId: model.ridexId,
      modelName: model.name,
      engineId: engine?.ridexId || null,
      engineName: engine?.name || null,
      confidence: groqResult.confidence,
      cached: false,
    };
  }

  // Garage CRUD
  async getGarage(userId) {
    return this.db.UserVehicle.findAll({
      where: { userId },
      include: [
        { model: this.db.VehicleModel, as: "vehicleModel" },
        { model: this.db.VehicleEngine, as: "vehicleEngine" },
      ],
      order: [["isDefault", "DESC"], ["createdAt", "DESC"]],
    });
  }

  async addToGarage(userId, data) {
    if (data.isDefault) {
      await this.db.UserVehicle.update({ isDefault: false }, { where: { userId } });
    }
    return this.db.UserVehicle.create({ ...data, userId });
  }

  async removeFromGarage(userId, id) {
    const vehicle = await this.db.UserVehicle.findOne({ where: { id, userId } });
    if (!vehicle) throw this.errorManager.getError("NOT_FOUND");
    await vehicle.destroy();
    return { success: true };
  }
}

export default VehicleService;
