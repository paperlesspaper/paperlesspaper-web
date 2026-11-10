import "dotenv/config";
import mongoose from "mongoose";
import { reconcileStorageOffline } from "../src/storage/storage.service.js";

const [organization, confirmation] = process.argv.slice(2);
if (
  !mongoose.isValidObjectId(organization) ||
  confirmation !== "--writers-stopped"
) {
  throw new Error(
    "Usage: npm run storage:reconcile -- ORGANIZATION_ID --writers-stopped. Stop all API and worker writers first."
  );
}
if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");
try {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log({
    organization,
    ...(await reconcileStorageOffline(organization)),
  });
} finally {
  await mongoose.disconnect();
}
