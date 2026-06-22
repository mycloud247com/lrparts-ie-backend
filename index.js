import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import compression from "compression";
import DB from "./config/database.js";
import initRouter from "./routes/router.js";
import cache from "./src/services/cache.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://lrparts-frontend.vercel.app",
  "lrparts-frontend.vercel.app",
  "lrparts.ie",
  "www.lrparts.ie",
  "https://lrparts.ie",
  "https://www.lrparts.ie",
  "https://lrparts-ie-frontend-kds9.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const app = express();

app.set("trust proxy", 1);

app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    exposedHeaders: ["X-New-Access-Token"],
  }),
);
app.use(cookieParser());
// Raw body for Stripe webhook signature verification
app.use("/api/checkout/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

async function start() {
  try {
    const db = new DB();
    await db.initiate();
    console.log("Database connected");

    // Init Redis (non-blocking — works without Redis too)
    cache.connect();
    console.log("Redis cache initialized");

    const router = await initRouter(db);
    app.use("/api", router);

    // Global error handler
    app.use((err, req, res, next) => {
      const status = err.status || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({
        message,
        status,
        success: false,
        error: err.errorCode || "Error",
      });
    });

    app.listen(PORT, () => {
      console.log(`LR Parts API running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
