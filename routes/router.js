import ErrorManager from "../src/utils/errorManager.js";
import express from "express";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

export default async (db) => {
  const errorManager = new ErrorManager();
  const router = express.Router();

  const asyncErrorHandler = (fn) => (req, res, next) => {
    try {
      Promise.resolve(fn(req, res, next)).catch((e) => {
        errorManager.handleError(e);
        const status = e.status || 500;
        const message = e.message || "Internal Server Error";
        return res.status(status).json({
          message,
          status,
          success: false,
          error: e.errorCode || "Error",
        });
      });
    } catch (error) {
      errorManager.handleError(error);
      return res.status(500).json({
        message: "Internal Server Error",
        status: 500,
        success: false,
      });
    }
  };

  const handleTransaction = async (fn) => {
    const transaction = await db.sequelize.transaction();
    try {
      const result = await fn(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  };

  const handleRoute = (ControllerClass, methodName, autoCommit) => {
    return async (req, res) => {
      const context = { req, res, db, errorManager };
      const controller = new ControllerClass(context);

      let result;
      if (autoCommit) {
        result = await handleTransaction(async (transaction) => {
          return await controller[methodName](transaction);
        });
      } else {
        result = await controller[methodName]();
      }

      if (result !== undefined && !res.headersSent) {
        res.json({
          data: result,
          message: "Success",
          status: 200,
          success: true,
        });
      }
    };
  };

  // Dynamic route loading
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const files = fs.readdirSync(__dirname);

  let allRoutes = [];

  for (const file of files) {
    if (file !== "router.js" && file.endsWith(".js")) {
      const routeModule = await import(new URL(file, import.meta.url).href);
      const routes = routeModule.default;
      if (Array.isArray(routes)) {
        allRoutes = allRoutes.concat(routes);
      }
    }
  }

  allRoutes.forEach((route) => {
    const { path: routePath, method, controller, action, middlewares, autoCommit } = route;
    if (routePath && method && controller && action) {
      const httpMethod = method.toLowerCase();
      if (typeof router[httpMethod] === "function") {
        router[httpMethod](
          routePath,
          middlewares || [],
          asyncErrorHandler(handleRoute(controller, action, autoCommit)),
        );
      }
    }
  });

  return router;
};
