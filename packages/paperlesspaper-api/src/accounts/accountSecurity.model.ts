import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: String, // Auth0 subject; one pending change and operation lock per account.
  pendingEmail: String,
  previousEmail: String,
  passwordChangedAt: String,
  tokenHash: { type: String, index: true },
  expiresAt: Date,
  sentAt: Date,
  language: String,
  lock: String,
  lockUntil: Date,
});

export default mongoose.models.AccountSecurity ||
  mongoose.model("AccountSecurity", schema);
