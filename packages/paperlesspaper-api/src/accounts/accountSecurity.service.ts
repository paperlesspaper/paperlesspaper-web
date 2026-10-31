import { createHash, randomBytes } from "node:crypto";
import { ApiError, auth0 } from "@internetderdinge/api";
import { sendSecurityEmail as sendEmail } from "./accountSecurity.email.js";
import AccountSecurity from "./accountSecurity.model.js";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const appUrl = () =>
  process.env.PAPERLESSPAPER_APP_URL || "https://web.paperlesspaper.de";
const pendingFields = {
  pendingEmail: 1,
  previousEmail: 1,
  passwordChangedAt: 1,
  tokenHash: 1,
  expiresAt: 1,
  language: 1,
};
const databaseIdentity = (account: any) =>
  account.identities?.find(
    (identity: any) => identity.provider === "auth0" && !identity.isSocial
  );

async function getAccount(owner: string) {
  return auth0.users.get(owner, {}, { timeoutInSeconds: 15, maxRetries: 0 });
}

function requireDatabase(account: any, changeEmail = false) {
  const identity = databaseIdentity(account);
  if (!identity || (changeEmail && !account.user_id?.startsWith("auth0|"))) {
    throw new ApiError(
      400,
      "Manage these login details with your sign-in provider."
    );
  }
  return identity;
}

// Serialize start/resend/cancel/confirm across API instances. The lease recovers
// after a crashed process. Auth0 calls have a shorter timeout than this lease.
async function withLock<T>(
  owner: string,
  operation: (state: any) => Promise<T>
): Promise<T> {
  try {
    await AccountSecurity.updateOne(
      { _id: owner },
      { $setOnInsert: { _id: owner } },
      { upsert: true }
    );
  } catch (error: any) {
    if (error.code !== 11000) throw error;
  }
  const lock = randomBytes(16).toString("hex");
  const state = await AccountSecurity.findOneAndUpdate(
    {
      _id: owner,
      $or: [
        { lockUntil: { $exists: false } },
        { lockUntil: { $lt: new Date() } },
      ],
    },
    { $set: { lock, lockUntil: new Date(Date.now() + 120_000) } },
    { new: true }
  );
  if (!state)
    throw new ApiError(
      409,
      "Another account change is in progress. Please try again."
    );
  try {
    return await operation(state);
  } finally {
    await AccountSecurity.updateOne(
      { _id: owner, lock },
      { $unset: { lock: 1, lockUntil: 1 } }
    );
  }
}

export async function securityStatus(owner: string) {
  const [account, state] = await Promise.all([
    getAccount(owner),
    AccountSecurity.findById(owner),
  ]);
  return {
    email: account.email,
    emailVerified: account.email_verified === true,
    canChangeEmail:
      !!databaseIdentity(account) && account.user_id?.startsWith("auth0|"),
    hasPassword: !!databaseIdentity(account),
    providers:
      account.identities?.map((identity: any) => identity.provider) || [],
    connection: databaseIdentity(account)?.connection,
    pendingEmail: state?.expiresAt > new Date() ? state.pendingEmail : null,
    resendAvailableAt: state?.sentAt
      ? new Date(state.sentAt.getTime() + 60_000).toISOString()
      : null,
  };
}

async function checkEmailAvailable(email: string, owner: string) {
  const accounts = await auth0.users.listUsersByEmail(
    { email },
    { timeoutInSeconds: 15, maxRetries: 0 }
  );
  if (accounts.some((account: any) => account.user_id !== owner)) {
    throw new ApiError(409, "This email address is already in use.");
  }
}

async function sendConfirmation(
  owner: string,
  email: string,
  language: string,
  state: any
) {
  const account = await getAccount(owner);
  requireDatabase(account, true);
  if (email.toLowerCase() === account.email?.toLowerCase())
    throw new ApiError(400, "Enter a different email address.");
  if (state.sentAt && Date.now() - state.sentAt.getTime() < 60_000)
    throw new ApiError(
      429,
      "Please wait a minute before sending another email."
    );
  await checkEmailAvailable(email, owner);
  const token = randomBytes(32).toString("hex");
  const update = {
    pendingEmail: email,
    previousEmail: account.email,
    passwordChangedAt: account.last_password_reset || "",
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    sentAt: new Date(),
    language,
  };
  await AccountSecurity.updateOne(
    { _id: owner, lock: state.lock },
    { $set: update }
  );
  const de = language === "de";
  try {
    await sendEmail({
      email,
      subject: de
        ? "Bestätige deine neue E-Mail-Adresse – paperlesspaper"
        : "Confirm your new email address – paperlesspaper",
      title: de
        ? "Neue E-Mail-Adresse bestätigen"
        : "Confirm your new email address",
      body: de
        ? "Bestätige deine neue E-Mail-Adresse für paperlesspaper. Bis dahin bleibt deine bisherige Adresse gültig. Dieser Link ist 24 Stunden gültig. Falls du diese Änderung nicht angefordert hast, ignoriere diese E-Mail."
        : "Confirm your new email address for paperlesspaper. Until then, your current address remains active. This link expires in 24 hours. If you did not request this change, ignore this email.",
      url: `${appUrl()}/confirm-email#token=${token}`,
      actionButtonText: de
        ? "E-Mail-Adresse bestätigen"
        : "Confirm email address",
    });
  } catch {
    // Preserve a previously delivered link if a resend fails.
    const previous = Object.fromEntries(
      Object.keys(update)
        .filter((key) => state[key] !== undefined)
        .map((key) => [key, state[key]])
    );
    const unset = Object.fromEntries(
      Object.keys(update)
        .filter((key) => state[key] === undefined)
        .map((key) => [key, 1])
    );
    await AccountSecurity.updateOne(
      { _id: owner, lock: state.lock },
      { $set: previous, $unset: unset }
    );
    throw new ApiError(503, "The email could not be sent. Please try again.");
  }
}

export async function requestEmailChange(
  owner: string,
  email: string,
  language: string
) {
  await withLock(owner, (state) =>
    sendConfirmation(owner, email, language, state)
  );
}

export async function resendEmailChange(owner: string) {
  await withLock(owner, async (state) => {
    if (!state.pendingEmail || state.expiresAt <= new Date())
      throw new ApiError(
        400,
        "This confirmation link has expired. Start a new email change."
      );
    await sendConfirmation(
      owner,
      state.pendingEmail,
      state.language || "en",
      state
    );
  });
}

export async function cancelEmailChange(owner: string) {
  await withLock(owner, async (state) => {
    await AccountSecurity.updateOne(
      { _id: owner, lock: state.lock },
      { $unset: pendingFields }
    );
  });
}

async function notifyChange(
  email: string,
  language: string,
  kind: "email" | "password",
  newEmail?: string
) {
  const de = language === "de";
  const title =
    kind === "email"
      ? de
        ? "Deine E-Mail-Adresse wurde geändert"
        : "Your email address was changed"
      : de
      ? "Dein Passwort wurde geändert"
      : "Your password was changed";
  try {
    await sendEmail({
      email,
      title,
      subject: `${title} – paperlesspaper`,
      body: `${
        kind === "email"
          ? `${de ? "Neue Adresse" : "New address"}: ${newEmail}.\n`
          : ""
      }${
        de
          ? "Falls du diese Änderung nicht vorgenommen hast, kontaktiere bitte umgehend den paperlesspaper-Support."
          : "If you did not make this change, please contact paperlesspaper support immediately."
      }`,
      url: `${appUrl()}/account`,
    });
  } catch {
    // The credential already changed. Do not report a failed mutation or log secrets.
    console.error("Account security notification could not be delivered");
  }
}

export async function confirmEmailChange(token: string) {
  const tokenHash = hash(token);
  const pending = await AccountSecurity.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });
  if (!pending)
    throw new ApiError(
      400,
      "This confirmation link is invalid or has expired."
    );
  await withLock(pending._id, async (state) => {
    // Recheck after locking: cancellation/resend may have replaced the token.
    if (state.tokenHash !== tokenHash || state.expiresAt <= new Date())
      throw new ApiError(
        400,
        "This confirmation link is invalid or has expired."
      );
    const account = await getAccount(state._id);
    requireDatabase(account, true);
    if (
      (account.last_password_reset || "") !== (state.passwordChangedAt || "")
    ) {
      throw new ApiError(
        409,
        "Your account has changed. Start a new email change."
      );
    }
    if (
      account.email !== state.previousEmail &&
      account.email !== state.pendingEmail
    )
      throw new ApiError(
        409,
        "Your account has changed. Start a new email change."
      );
    if (account.email !== state.pendingEmail || !account.email_verified) {
      await checkEmailAvailable(state.pendingEmail, state._id);
      await auth0.users.update(
        state._id,
        {
          email: state.pendingEmail,
          email_verified: true,
          verify_email: false,
        },
        { timeoutInSeconds: 30, maxRetries: 0 }
      );
    }
    // A retry after a crashed process can finish cleanup if Auth0 already changed.
    await AccountSecurity.updateOne(
      { _id: state._id, lock: state.lock },
      { $unset: pendingFields }
    );
    await notifyChange(
      state.previousEmail,
      state.language || "en",
      "email",
      state.pendingEmail
    );
  });
}

export async function changePassword(owner: string, password: string) {
  await withLock(owner, async (state) => {
    const account = await getAccount(owner);
    const identity = requireDatabase(account);
    try {
      await auth0.users.update(
        owner,
        { password, connection: identity.connection },
        { timeoutInSeconds: 30, maxRetries: 0 }
      );
    } catch (error: any) {
      if (error.statusCode === 400)
        throw new ApiError(
          400,
          "Choose a stronger password that you have not used before."
        );
      throw new ApiError(
        502,
        "Your password could not be changed. Please try again."
      );
    }
    await AccountSecurity.updateOne(
      { _id: owner, lock: state.lock },
      { $unset: pendingFields }
    );
    await notifyChange(
      account.email!,
      account.app_metadata?.language || "en",
      "password"
    );
  });
}

export async function resetPassword(owner: string, clientId: string) {
  const account = await getAccount(owner);
  const identity = requireDatabase(account);
  if (!clientId) throw new ApiError(401, "Please sign in again to continue.");
  const response = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/dbconnections/change_password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        email: account.email,
        connection: identity.connection,
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok)
    throw new ApiError(502, "The email could not be sent. Please try again.");
}
