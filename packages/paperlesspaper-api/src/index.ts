import dotenv from "dotenv";
import os from "os";
import v8 from "v8";
import path from "path";
import mongoose from "mongoose";
import app from "./app";
import config from "@internetderdinge/api/src/config/config";
import logger from "@internetderdinge/api/src/config/logger";
import { fileURLToPath } from "url";
import { initI18n } from "@internetderdinge/api/src/i18n/i18n";
import { initDeviceList } from "@internetderdinge/api/src/utils/deviceUtils";
import { deviceList } from "@wirewire/helpers";

if (process.env?.NODE_ENV) {
  dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
} else {
  dotenv.config({ path: ".env" });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initI18n({ generatedPath: path.join(__dirname, "../i18n/generated") });
initDeviceList({ list: deviceList });

let server: import("http").Server;

mongoose
  .connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    logger.info("Connected to MongoDB");
    server = app.listen(config.port, () => {
      logger.info(`Listening to port ${config.port}`);
    });
  })
  .catch((err) => {
    logger.error("MongoDB connection error:", err);
    process.exit(1);
  });

const exitHandler = (reason?: string, error?: unknown) => {
  if (reason) {
    logger.info(`Exit handler triggered: ${reason}`);
  }
  if (error instanceof Error) {
    logger.error(`Exit handler error: ${error.message}`, {
      stack: error.stack,
    });
  } else if (error) {
    logger.error("Exit handler error:", error);
  } else {
    logger.info("Exit handler stack:", {
      stack: new Error("exitHandler stack").stack,
    });
  }
  try {
    const mem = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapSpaces = v8.getHeapSpaceStatistics();
    const totalMem = os.totalmem();
    logger.info("Memory usage on exit", {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      rssPct: totalMem ? Math.round((mem.rss / totalMem) * 1000) / 10 : null,
    });
    logger.info("Heap statistics on exit", heapStats);
    logger.info("Heap spaces on exit", heapSpaces);
    logger.info("Resource usage on exit", process.resourceUsage());
  } catch (memError) {
    logger.error("Failed to read memory usage", memError);
  }
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const logUnexpectedError = (label: string, error: unknown) => {
  if (error instanceof Error) {
    logger.error(`${label}: ${error.message}`, { stack: error.stack });
  } else {
    logger.error(`${label}:`, error);
  }
};

process.on("uncaughtException", (error) => {
  logUnexpectedError("Uncaught exception", error);
  exitHandler("uncaughtException", error);
});
process.on("unhandledRejection", (reason) => {
  logUnexpectedError("Unhandled rejection", reason);
  exitHandler("unhandledRejection", reason);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  exitHandler("SIGTERM");
});

process.on("SIGINT", () => {
  logger.info("SIGINT received");
  exitHandler("SIGINT");
});

process.on("SIGQUIT", () => {
  logger.info("SIGQUIT received");
  exitHandler("SIGQUIT");
});

process.on("SIGUSR2", () => {
  logger.info("SIGUSR2 received");
  exitHandler("SIGUSR2");
});

process.on("beforeExit", (code) => {
  logger.info(`beforeExit with code ${code}`);
});

process.on("exit", (code) => {
  logger.info(`exit with code ${code}`);
});

process.on("warning", (warning) => {
  logger.warn(`Process warning: ${warning.name} ${warning.message}`, {
    stack: warning.stack,
  });
});
