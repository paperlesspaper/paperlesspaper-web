import express, { type Request, type Response } from "express";
import { authorizedMonitor, slideshowSnapshot } from "./snapshot";

const router = express.Router();
let reading = false;
router.get("/slideshows", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  if (!authorizedMonitor(req.headers.authorization)) {
    res.status(401).json({ error: "Monitor authentication required" });
    return;
  }
  const after = req.query.after;
  if (
    after !== undefined &&
    (typeof after !== "string" || !/^[a-f0-9]{24}$/i.test(after))
  ) {
    res.status(400).json({ error: "Invalid cursor" });
    return;
  }
  if (reading) {
    res.status(429).json({ error: "Monitor snapshot in progress" });
    return;
  }
  reading = true;
  try {
    res.json(await slideshowSnapshot(after as string | undefined));
  } catch {
    res.status(503).json({ error: "Slideshow snapshot unavailable" });
  } finally {
    reading = false;
  }
});
export default router;
