/**
 * RIDEX subcategory IDs — used by the AJAX listing endpoint.
 * Each slug maps to a numeric subcategoryId that RIDEX uses internally.
 */
export const SUBCATEGORY_IDS = {
  // Filters
  "filters/filter-interior-air": "100020",
  "filters/oil-filter": "10359",
  "filters/air-filter": "10360",
  "filters/fuel-filter": "10361",

  // Brake System
  "brake-system/brake-pad-set": "10130",
  "brake-system/brake-disc": "10132",
  "brake-system/brake-caliper": "10907",
  "brake-system/brake-shoes": "10131",
  "brake-system/brake-hoses": "10135",
  "brake-system/brake-drum": "10133",
  "brake-system/wheel-brake-cylinder": "10128",
  "brake-system/wear-indicator-brake-pads": "10731",
  "brake-system/accessory-kit-disc-brake-pads": "10730",
  "brake-system/cable-parking-brake": "10735",
  "brake-system/sensor-wheel-speed": "10138",
  "brake-system/brake-kit": "12344",

  // Suspension
  "suspension/shock-absorber": "10221",
  "suspension/coil-spring": "10213",
  "suspension/strut-mount-and-bearing": "10471",

  // Steering
  "steering/rod-assembly": "74815",
  "steering/tie-rod-end": "10703",
  "steering/tie-rod-axle-joint": "10298",
  "steering/power-steering-pump": "13258",
  "steering/steering-gear": "10299",

  // Cooling System
  "cooling-system/thermostat": "10195",
  "cooling-system/water-pump": "10191",
  "cooling-system/expansion-tank-coolant": "100039",
  "cooling-system/radiator-fan": "10437",
  "cooling-system/fan-clutch": "15050",

  // Engine
  "engine/engine-mounting": "10638",

  // Belt Drive
  "belt-drive/v-ribbed-belt": "10531",
  "belt-drive/timing-belt-set": "10505",
  "belt-drive/water-pump-timing-belt-kit": "10553",
  "belt-drive/tensioner-pulley-timing-belt": "14420",
  "belt-drive/tensioner-pulley-v-ribbed-belt": "10534",

  // Ignition
  "spark-glow-ignition/spark-plug": "10251",
  "spark-glow-ignition/glow-plug": "10252",
  "spark-glow-ignition/ignition-coil": "10250",

  // Fuel System
  "fuel-mixture-formation/fuel-pump": "10817",
  "fuel-mixture-formation/injector-nozzle": "12899",

  // Windscreen
  "windscreen-cleaning-system/wiper-blades": "10233",
  "windscreen-cleaning-system/water-pump-window-cleaning": "100151",

  // Drive Shaft
  "wheel-drive/drive-shaft": "10162",
  "wheel-drive/joint-kit-drive-shaft": "10171",

  // Axle / Suspension Arms
  "axle-mounting-steering-wheels/track-control-arm": "10671",
  "axle-mounting-steering-wheels/wheel-bearing-kit": "101014",
  "axle-mounting-steering-wheels/wheel-hub": "10678",
  "axle-mounting-steering-wheels/air-spring-suspension": "101038",
  "axle-mounting-steering-wheels/stabiliser-mounting": "101026",
  "axle-mounting-steering-wheels/arm-bushes": "10672",

  // Body
  "body/tailgate-struts": "10926",
  "body/mirror-glass-outside-mirror": "11798",
  "body/parking-sensor": "10718",

  // Transmission
  "transmission/hydraulic-filter-automatic-transmission": "12315",

  // Interior
  "interior-equipment/gas-spring-bonnet": "11877",
};

export const ALL_SUBCATEGORY_SLUGS = Object.keys(SUBCATEGORY_IDS);
