import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const errorsRaw = fs.readFileSync(path.join(__dirname, "errors.json"), "utf-8");
const ERROR_DEFS = JSON.parse(errorsRaw);

class ErrorManager {
  getError(code, overrideMessage) {
    const def = ERROR_DEFS[code] || ERROR_DEFS.INTERNAL_ERROR;
    const err = new Error(overrideMessage || def.message);
    err.status = def.status;
    err.errorCode = code;
    return err;
  }

  handleError(err) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ErrorManager] ${err.errorCode || "UNKNOWN"}:`, err.message);
    }
  }
}

export default ErrorManager;
