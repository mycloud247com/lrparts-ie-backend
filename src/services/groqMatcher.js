import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, "../../data/vehicle-catalog-slim.json");

let catalogCache = null;

function getCatalog() {
  if (catalogCache) return catalogCache;
  catalogCache = fs.readFileSync(CATALOG_PATH, "utf-8");
  return catalogCache;
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Use Groq LLM to match a MotorCheck vehicle description to our DB models/engines.
 *
 * @param {string} details — e.g. "Land Rover Range Rover Rangerover Sport HSE P400E AWD HSE 5DR A"
 * @param {number|null} engineCC — e.g. 1997
 * @param {number|null} bhp — e.g. 300
 * @param {string} fuel — e.g. "Petrol/plug-in electric"
 * @param {number|null} year — e.g. 2019
 * @returns {{ modelId: string, engineId: string, confidence: number } | null}
 */
export async function matchWithGroq(details, engineCC, bhp, fuel, year) {
  if (!process.env.GROQ_API_KEY) return null;

  const catalog = getCatalog();

  const prompt = `You are a Land Rover vehicle identification expert. Given a vehicle description from an Irish registration lookup, match it to the EXACT model and engine from our database catalog.

VEHICLE FROM REG LOOKUP:
- Description: "${details}"
- Engine CC: ${engineCC || "unknown"}
- BHP: ${bhp || "unknown"}
- Fuel: "${fuel || "unknown"}"
- Year: ${year || "unknown"}

OUR DATABASE CATALOG (JSON array of models, each with engines):
${catalog}

RULES:
1. Match to the MOST SPECIFIC model. "Range Rover Sport" is NOT "Range Rover" — they are different models.
2. Use the year to pick the correct generation (e.g. Range Rover L405 is 2012-2021, L460 is 2021+)
3. Match engine by CC (displacement) first, then fuel type, then HP (power).
4. CC tolerance: within 50cc. If CC is 1997, match engines with displacement 1997 or 1999.
5. For hybrid/electric vehicles, match to petrol engines with matching CC.
6. "P400e" means 2.0 petrol plug-in hybrid (1997cc). "SDV6" means diesel. "V8 Supercharged" means petrol 5000cc.
7. If BHP is 0 or unknown, ignore it for matching.

Respond with ONLY a JSON object, no explanation:
{"modelId": "the_model_ridex_id", "engineId": "the_engine_ridex_id", "confidence": 0-100}

If you cannot match confidently, return: {"modelId": null, "engineId": null, "confidence": 0}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;

    const result = JSON.parse(text);
    if (result.modelId && result.confidence > 0) {
      return {
        modelId: String(result.modelId),
        engineId: result.engineId ? String(result.engineId) : null,
        confidence: result.confidence,
      };
    }
    return null;
  } catch (err) {
    console.error("Groq matching error:", err.message);
    return null;
  }
}
