import express from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { auth, ApiError, catchAsync } from "@internetderdinge/api";
import { authorizedPaper, authorizeConnection } from "./access.js";
import {
  PushConnection,
  PushGrant,
  PushRequest,
  PushDelivery,
} from "./models.js";
import { secret, hash } from "./security.js";
import {
  acceptContent,
  getIntegrationRenderContent,
  MAX_IMAGE_BYTES,
} from "./content.js";
import { bullMqEnabled } from "../cronjobs/bullmq.service.js";

const router = express.Router();
const grantSchema = z.object({ grant: z.string().regex(/^[\w-]{43}$/) });
const contentSchema = z.object({
  messageId: z.string().min(1).max(128),
  text: z.string().max(1000).optional(),
  imageBase64: z
    .string()
    .max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4)
    .optional(),
});
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "Invalid integration request");
  return result.data;
};
router.use((_req: any, res: any, next: any) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.post(
  "/papers/:paperId/grants",
  auth(),
  catchAsync(async (req: any, res: any) => {
    if (!bullMqEnabled)
      throw new ApiError(503, "Integration processing is disabled");
    const { paper, identity } = await authorizedPaper(
      req.auth?.sub,
      req.params.paperId
    );
    if (req.body?.configUrl !== identity.configUrl)
      throw new ApiError(409, "Save the integration configuration first");
    if (req.body?.settingsPage !== identity.settingsUrl)
      throw new ApiError(409, "Save the integration settings page first");
    const grant = secret();
    await PushGrant.deleteMany({ owner: req.auth.sub, paperId: paper._id });
    await PushGrant.create({
      _id: hash(grant),
      owner: req.auth.sub,
      paperId: paper._id,
      source: identity.source,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    res.status(201).send({ grant });
  })
);
router.post(
  "/exchange",
  rateLimit({ windowMs: 60_000, limit: 60 }),
  catchAsync(async (req: any, res: any) => {
    const { grant } = parse(grantSchema, req.body);
    const saved = await PushGrant.findOneAndDelete({
      _id: hash(grant),
      expiresAt: { $gt: new Date() },
    });
    if (!saved) throw new ApiError(401, "Connection grant expired or used");
    const { paper, identity } = await authorizedPaper(
      saved.owner,
      String(saved.paperId)
    );
    if (identity.source !== saved.source)
      throw new ApiError(409, "Integration changed");
    const token = secret(),
      callbackToken = secret();
    const credentials = {
      generation: secret(),
      organization: paper.organization,
      source: identity.source,
      callbackUrl: identity.callbackUrl,
      tokenHash: hash(token),
      tokenSecret: token,
      callbackToken,
      revoked: false,
    };
    // Opening settings again reuses the connection; rotating on every visit would
    // invalidate in-flight sends and callbacks from other tabs.
    let connection = await PushConnection.findOneAndUpdate(
      { paperId: paper._id, owner: saved.owner },
      { $setOnInsert: credentials },
      { upsert: true, new: true }
    ).select("+tokenSecret +callbackToken");
    if (
      connection.revoked ||
      connection.source !== identity.source ||
      String(connection.organization) !== String(paper.organization) ||
      !connection.generation ||
      !connection.tokenSecret
    ) {
      connection = await PushConnection.findOneAndUpdate(
        { _id: connection._id, tokenHash: connection.tokenHash },
        { $set: credentials },
        { new: true }
      ).select("+tokenSecret +callbackToken");
      if (!connection) throw new ApiError(409, "Connection changed; reconnect");
    }
    res.send({
      connectionId: String(connection._id),
      paperId: String(paper._id),
      name: paper.name || "Paper",
      token: connection.tokenSecret,
      callbackToken: connection.callbackToken,
    });
  })
);
router.get(
  "/papers/:paperId/content",
  auth(),
  catchAsync(async (req: any, res: any) => {
    const {
      paper,
      identity: { configUrl, renderUrl },
    } = await authorizedPaper(req.auth?.sub, req.params.paperId);
    res.send({
      content: await getIntegrationRenderContent(paper),
      configUrl,
      renderUrl,
    });
  })
);
router.delete(
  "/papers/:paperId/connection",
  auth(),
  catchAsync(async (req: any, res: any) => {
    // Revocation remains possible even if an integration's manifest is no longer valid.
    if (!/^[a-f\d]{24}$/i.test(req.params.paperId))
      throw new ApiError(400, "Invalid paper");
    await PushGrant.deleteMany({
      paperId: req.params.paperId,
      owner: req.auth?.sub,
    });
    await PushConnection.updateMany(
      { paperId: req.params.paperId, owner: req.auth?.sub },
      { $set: { revoked: true } }
    );
    res.sendStatus(204);
  })
);
router.use(
  "/connections/:connectionId",
  catchAsync(async (req: any, _res: any, next: any) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.connectionId))
      throw new ApiError(401, "Invalid connection");
    const token = /^Bearer ([\w-]{43})$/.exec(
      req.get("authorization") || ""
    )?.[1];
    const connection =
      token &&
      (await PushConnection.findOne({
        _id: req.params.connectionId,
        tokenHash: hash(token),
        revoked: false,
      }));
    req.pushPaper = await authorizeConnection(connection);
    req.pushConnection = connection;
    next();
  })
);
router.post(
  "/connections/:connectionId/content",
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    keyGenerator: (req: any) => String(req.pushConnection._id),
  }),
  catchAsync(async (req: any, res: any) => {
    if (!bullMqEnabled)
      throw new ApiError(503, "Integration processing is disabled");
    const body = parse(contentSchema, req.body);
    const request = await acceptContent(req.pushConnection, body);
    res.status(202).send({
      requestId: request._id,
      paperId: String(request.paperId),
      messageId: request.messageId,
      state: request.state,
    });
  })
);
router.get(
  "/connections/:connectionId/status",
  catchAsync(async (req: any, res: any) => {
    const request = await PushRequest.findOne({
      connectionId: req.pushConnection._id,
      connectionGeneration: req.pushConnection.generation,
      source: req.pushConnection.source,
    }).sort({ createdAt: -1 });
    const deliveries = request
      ? await PushDelivery.find({ requestId: request._id }).select(
          "deviceId frameName state"
        )
      : [];
    res.send({
      paperId: String(req.pushConnection.paperId),
      name: req.pushPaper.name,
      state: request?.state || "empty",
      messageId: request?.messageId,
      deliveries,
    });
  })
);
router.delete(
  "/connections/:connectionId",
  catchAsync(async (req: any, res: any) => {
    await PushConnection.updateOne(
      {
        _id: req.pushConnection._id,
        generation: req.pushConnection.generation,
      },
      { $set: { revoked: true } }
    );
    res.sendStatus(204);
  })
);
export default router;
