import express from "express";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import type { CorsOptions } from "cors";
import httpStatus from "http-status";
import * as ztoapi from "@asteasolutions/zod-to-openapi";
import swaggerUi from "swagger-ui-express";

import {
  config,
  morgan,
  registry,
  errorConverter,
  errorHandler,
  ApiError,
} from "@internetderdinge/api";

import routes from "./routes/v1/index";
import z from "zod";

const { OpenApiGeneratorV3 } = ztoapi;

const app = express();

const generator = new OpenApiGeneratorV3(registry.definitions);

const tags = [
  { name: "Papers", description: "Paperlesspaper screens and content" },
  { name: "Render", description: "Image rendering utilities" },
  {
    name: "Devices",
    description: "Device management endpoints (shared OpenIoT)",
  },
];

const openApiDoc = generator.generateDocument({
  openapi: "3.0.3",
  info: { title: "paperlesspaper API", version: "1.0.0" },
  servers: [{ url: "http://localhost:5003/v1" }],
  security: [{ bearerAuth: [] }],
  tags,
});

const options = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .scheme-container { border-color: #007bff; }
    .swagger-ui .info .title { color: #007bff; }
  `,
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDoc, options));
app.get("/openapi.json", (_req, res) => res.json(openApiDoc));

if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

app.use(helmet());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(compression());

// ───── CORS ──────────────────────────────────────────────────────────────────
const whitelist = [
  "https://memo.wirewire.de",
  "https://web.wirewire.de",
  "http://localhost",
  "http://localhost:3200",
  "capacitor://localhost",
  "http://localhost:3000",
  "https://anabox-smart.de",
  "https://localhost",
  "http://next-pwa:3000",
  "https://next-pwa:3000",
  "http://localhost:3400",
  "https://web.paperlesspaper.de",
];
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};
app.use(cors(corsOptions));
app.use("/v1", routes);

const healthMessage = `paperlesspaper API v${process.env.npm_package_version} env: ${config.env}`;
app.get("/", (_req, res) => res.send(healthMessage));
app.get("/health", (_req, res) => res.send(healthMessage));

app.use((_req, _res, next: NextFunction) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});
app.use(errorConverter);
app.use(errorHandler);

export default app;
