/**
 * Maps RIDEX category slugs to our database category slugs.
 * Key = RIDEX subcategory slug (e.g., "brake-system/brake-pad-set")
 * Value = our category slug in the categories table
 *
 * Strategy:
 * 1. Try exact subcategory match
 * 2. Try parent slug (everything before the /)
 * 3. If no match, store ridex_category_slug for manual mapping later
 */

// RIDEX subcategory slug → our slug
export const SUBCATEGORY_MAP = {
  // Brake System
  "brake-system/brake-pad-set": "brake-pads",
  "brake-system/brake-disc": "brake-discs",
  "brake-system/brake-caliper": "brake-calipers",
  "brake-system/brake-shoes": "brake-pads",
  "brake-system/brake-hose": "brake-system",
  "brake-system/brake-drum": "brake-system",
  "brake-system/wheel-brake-cylinder": "brake-system",
  "brake-system/wear-indicator": "wear-sensors",
  "brake-system/brake-fluid": "brake-fluid",

  // Filters
  "filters/oil-filter": "oil-filters",
  "filters/air-filter": "air-filters",
  "filters/fuel-filter": "fuel-filters",
  "filters/filter-interior-air": "cabin-filters",

  // Engine
  "engine/gasket-cylinder-head": "gaskets",
  "engine/gasket-set-cylinder-head": "gaskets",
  "engine/timing-belt": "timing-belts",
  "engine/timing-belt-kit": "timing-belts",
  "engine/water-pump": "water-pumps",
  "engine/engine-mounting": "engine-mounts",
  "engine/oil-pump": "engine",
  "engine/valve-cover-gasket": "gaskets",
  "engine/piston-ring": "engine",
  "engine/camshaft": "engine",
  "engine/rocker-cover": "engine",

  // Suspension
  "axle-mounting-steering-wheels/control-arm": "control-arms",
  "axle-mounting-steering-wheels/ball-joint": "suspension",
  "axle-mounting-steering-wheels/stabiliser-link": "suspension",
  "axle-mounting-steering-wheels/wheel-bearing": "suspension",
  "axle-mounting-steering-wheels/wheel-hub": "suspension",
  "axle-mounting-steering-wheels/rubber-mounting": "bushes",
  "axle-mounting-steering-wheels/silent-bloc": "bushes",

  // Suspension (shock absorbers group)
  "suspension/shock-absorber": "shock-absorbers",
  "suspension/coil-spring": "springs",
  "suspension/air-spring": "air-suspension",
  "suspension/spring-cap": "springs",
  "suspension/shock-absorber-dust-cover": "shock-absorbers",

  // Steering
  "steering/tie-rod": "tie-rods",
  "steering/tie-rod-end": "tie-rods",
  "steering/steering-rack": "steering-racks",
  "steering/power-steering-pump": "steering-pumps",
  "steering/steering-gear": "steering-racks",

  // Cooling System
  "cooling-system/radiator": "radiators",
  "cooling-system/thermostat": "thermostats",
  "cooling-system/coolant-hose": "coolant-hoses",
  "cooling-system/fan-radiator": "cooling-fans",
  "cooling-system/water-pump": "water-pumps",
  "cooling-system/expansion-tank": "cooling-system",

  // Belt Drive
  "belt-drive/v-ribbed-belt": "engine",
  "belt-drive/tensioner-pulley": "engine",
  "belt-drive/idler-pulley": "engine",

  // Fuel System
  "fuel-mixture-formation/fuel-pump": "fuel-filters",
  "fuel-mixture-formation/injector": "engine",
  "fuel-mixture-formation/fuel-filter": "fuel-filters",
  "fuel-mixture-formation/throttle-body": "engine",

  // Ignition
  "spark-glow-ignition/spark-plug": "engine",
  "spark-glow-ignition/glow-plug": "engine",
  "spark-glow-ignition/ignition-coil": "engine",

  // Drive Shaft
  "wheel-drive/drive-shaft": "transmission",
  "wheel-drive/cv-joint": "transmission",
  "wheel-drive/drive-shaft-joint": "transmission",

  // Electrical / Sensors
  "information-communication-systems/sensor": "electrical-sensors",
  "information-communication-systems/lambda-sensor": "electrical-sensors",
  "information-communication-systems/abs-sensor": "electrical-sensors",
  "information-communication-systems/park-sensor": "electrical-sensors",

  // Windscreen
  "windscreen-cleaning-system/wiper-blade": "body",
  "windscreen-cleaning-system/washer-pump": "body",

  // Interior
  "interior-equipment/mirror": "body",
  "interior-equipment/window-regulator": "body",

  // Heating
  "heating-ventilation/heater-blower": "body",
  "heating-ventilation/air-conditioning": "body",
};

// RIDEX parent slug → our parent category slug (fallback)
export const PARENT_MAP = {
  "brake-system": "brake-system",
  "filters": "filters",
  "engine": "engine",
  "axle-mounting-steering-wheels": "suspension",
  "suspension": "suspension",
  "steering": "steering",
  "cooling-system": "cooling-system",
  "belt-drive": "engine",
  "fuel-mixture-formation": "engine",
  "spark-glow-ignition": "engine",
  "wheel-drive": "transmission",
  "information-communication-systems": "electrical-sensors",
  "windscreen-cleaning-system": "body",
  "interior-equipment": "body",
  "heating-ventilation": "body",
  "body": "body",
  "repair-kits": "body",
  "car-accessories": "body",
  "ridex-reman": "engine",
  "transmission": "transmission",
  "tools": "body",
};

/**
 * Resolve a RIDEX category slug to our category slug.
 * @param {string} ridexSlug - e.g., "brake-system/brake-pad-set"
 * @returns {string|null} Our category slug or null if unmapped
 */
export function resolveCategory(ridexSlug) {
  // Try exact subcategory match
  if (SUBCATEGORY_MAP[ridexSlug]) return SUBCATEGORY_MAP[ridexSlug];

  // Try parent slug
  const parent = ridexSlug.includes("/") ? ridexSlug.split("/")[0] : ridexSlug;
  if (PARENT_MAP[parent]) return PARENT_MAP[parent];

  return null;
}
