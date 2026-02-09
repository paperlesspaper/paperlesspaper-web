import express from "express";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import type { CorsOptions } from "cors";
import httpStatus from "http-status";
import * as ztoapi from "@asteasolutions/zod-to-openapi";
import swaggerUi from "swagger-ui-express";

import config from "@internetderdinge/api/src/config/config";
import morgan from "@internetderdinge/api/src/config/morgan";
import { registry } from "@internetderdinge/api/src/utils/registerOpenApi";
import {
  errorConverter,
  errorHandler,
} from "@internetderdinge/api/src/middlewares/error";
import ApiError from "@internetderdinge/api/src/utils/ApiError";

import routes from "./routes/v1/index";

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

const corsOptions: CorsOptions = {
  origin: (_origin, callback) => callback(null, true),
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
