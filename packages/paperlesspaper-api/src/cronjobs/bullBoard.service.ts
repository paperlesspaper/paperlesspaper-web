import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { timingSafeEqual } from "node:crypto";
import { bullMqEnabled, queue, papersQueue } from "./bullmq.service";

const bullBoardUsername = process.env.BULL_BOARD_USERNAME || "admin";
const bullBoardPassword = process.env.BULL_BOARD_PASSWORD || "admin";

const unauthorized = (res: Response) => {
  res.set("WWW-Authenticate", 'Basic realm="Bull Board"');
  res.status(401).send("Authentication required");
};

const equalsSafe = (value: string, expected: string) => {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
};

const bullBoardBasicAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Basic ")) {
    unauthorized(res);
    return;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const separatorIndex = credentials.indexOf(":");

  if (separatorIndex < 0) {
    unauthorized(res);
    return;
  }

  const username = credentials.slice(0, separatorIndex);
  const password = credentials.slice(separatorIndex + 1);

  if (
    !equalsSafe(username, bullBoardUsername) ||
    !equalsSafe(password, bullBoardPassword)
  ) {
    unauthorized(res);
    return;
  }

  next();
};

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

if (bullMqEnabled && queue && papersQueue) {
  createBullBoard({
    queues: [new BullMQAdapter(queue), new BullMQAdapter(papersQueue)],
    serverAdapter,
  });
}

const bullBoardBaseRouter = serverAdapter.getRouter();

export const bullBoardRouter = Router();
bullBoardRouter.use(bullBoardBasicAuth);
bullBoardRouter.use((req, res, next) => {
  if (!bullMqEnabled) {
    res.status(503).send("BullMQ is disabled because Redis is not configured.");
    return;
  }

  next();
});
bullBoardRouter.use(bullBoardBaseRouter);
