import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  lookup: vi.fn(),
  mail: vi.fn(),
  state: undefined as any,
}));
vi.mock("@internetderdinge/api", async () => {
  const { default: ApiError } = await import(
    "@internetderdinge/api/src/utils/ApiError"
  );
  return {
    ApiError,
    auth0: {
      users: {
        get: mocks.get,
        update: mocks.update,
        listUsersByEmail: mocks.lookup,
      },
    },
  };
});
vi.mock("../../src/accounts/accountSecurity.email.js", () => ({
  sendSecurityEmail: mocks.mail,
}));
vi.mock("../../src/accounts/accountSecurity.model.js", () => ({
  default: {
    updateOne: vi.fn(async (filter, update) => {
      if (!mocks.state) mocks.state = { _id: filter._id };
      if (filter.lock && mocks.state.lock !== filter.lock)
        return { modifiedCount: 0 };
      Object.assign(mocks.state, update.$set);
      for (const key of Object.keys(update.$unset || {}))
        delete mocks.state[key];
      return { modifiedCount: 1 };
    }),
    findOneAndUpdate: vi.fn(async (_filter, update) => {
      if (mocks.state.lockUntil > new Date()) return null;
      Object.assign(mocks.state, update.$set);
      return { ...mocks.state };
    }),
    findById: vi.fn(async () => mocks.state),
    findOne: vi.fn(async (filter) =>
      mocks.state?.tokenHash === filter.tokenHash &&
      mocks.state?.expiresAt > new Date()
        ? { ...mocks.state }
        : null
    ),
  },
}));

import {
  cancelEmailChange,
  changePassword,
  confirmEmailChange,
  requestEmailChange,
  resendEmailChange,
  securityStatus,
} from "../../src/accounts/accountSecurity.service.js";

const owner = "auth0|account";
const account = () => ({
  user_id: owner,
  email: "old@example.com",
  email_verified: true,
  identities: [{ provider: "auth0", connection: "database", isSocial: false }],
});
const tokenFromMail = () =>
  new URL(mocks.mail.mock.calls[0][0].url).hash.split("=")[1];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = undefined;
  mocks.get.mockResolvedValue(account());
  mocks.lookup.mockResolvedValue([]);
  mocks.mail.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue({});
});

describe("account security", () => {
  it("invalidates pending email changes after password recovery", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    mocks.get.mockResolvedValue({
      ...account(),
      last_password_reset: new Date().toISOString(),
    });
    await expect(confirmEmailChange(tokenFromMail())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cancels an outstanding email change when the password changes", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    const token = tokenFromMail();
    await changePassword(owner, "a-new-long-password");
    await expect(confirmEmailChange(token)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.state.pendingEmail).toBeUndefined();
  });

  it("keeps the old address active and stores only a hash until the new mailbox is confirmed", async () => {
    await requestEmailChange(owner, "new@example.com", "de");
    const token = tokenFromMail();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.state.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex")
    );
    expect(JSON.stringify(mocks.state)).not.toContain(token);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(await securityStatus(owner)).toMatchObject({
      email: "old@example.com",
      pendingEmail: "new@example.com",
    });
    await confirmEmailChange(token);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
      owner,
      { email: "new@example.com", email_verified: true, verify_email: false },
      expect.any(Object)
    );
    expect(mocks.mail).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: "old@example.com" })
    );
    await expect(confirmEmailChange(token)).rejects.toThrow(
      "invalid or has expired"
    );
  });

  it("invalidates the old link after resend and after cancellation", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    const token = tokenFromMail();
    await expect(resendEmailChange(owner)).rejects.toMatchObject({
      statusCode: 429,
    });
    mocks.state.sentAt = new Date(Date.now() - 61_000);
    await resendEmailChange(owner);
    await expect(confirmEmailChange(token)).rejects.toThrow(
      "invalid or has expired"
    );
    const newToken = new URL(mocks.mail.mock.calls[1][0].url).hash.split(
      "="
    )[1];
    await cancelEmailChange(owner);
    await expect(confirmEmailChange(newToken)).rejects.toThrow(
      "invalid or has expired"
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects expired links even before MongoDB cleanup", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    mocks.state.expiresAt = new Date(Date.now() - 1);
    await expect(confirmEmailChange(tokenFromMail())).rejects.toThrow(
      "invalid or has expired"
    );
    expect((await securityStatus(owner)).pendingEmail).toBeNull();
  });

  it("restores the previous pending change if email delivery fails", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    const token = tokenFromMail();
    mocks.state.sentAt = new Date(Date.now() - 61_000);
    mocks.mail.mockRejectedValueOnce(new Error("SES unavailable"));
    await expect(resendEmailChange(owner)).rejects.toMatchObject({
      statusCode: 503,
    });
    await confirmEmailChange(token);
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it("rejects conflicting addresses both before sending and at confirmation", async () => {
    mocks.lookup.mockResolvedValueOnce([{ user_id: "auth0|someone-else" }]);
    await expect(
      requestEmailChange(owner, "taken@example.com", "en")
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.mail).not.toHaveBeenCalled();
    await requestEmailChange(owner, "new@example.com", "en");
    mocks.lookup.mockResolvedValueOnce([{ user_id: "auth0|someone-else" }]);
    await expect(confirmEmailChange(tokenFromMail())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not overwrite an externally changed account", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    mocks.get.mockResolvedValue({
      ...account(),
      email: "external@example.com",
    });
    await expect(confirmEmailChange(tokenFromMail())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recovers a confirmation whose Auth0 update succeeded before a process restart", async () => {
    await requestEmailChange(owner, "new@example.com", "en");
    mocks.get.mockResolvedValue({ ...account(), email: "new@example.com" });
    await confirmEmailChange(tokenFromMail());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.state.pendingEmail).toBeUndefined();
  });

  it("serializes competing account writes", async () => {
    mocks.state = {
      _id: owner,
      lock: "other",
      lockUntil: new Date(Date.now() + 30_000),
    };
    await expect(
      requestEmailChange(owner, "new@example.com", "en")
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.mail).not.toHaveBeenCalled();
  });

  it.each(["apple", "google-oauth2"])(
    "leaves %s credentials with the sign-in provider",
    async (provider) => {
      mocks.get.mockResolvedValue({
        ...account(),
        user_id: `${provider}|account`,
        identities: [{ provider, isSocial: true }],
      });
      expect(await securityStatus(owner)).toMatchObject({
        hasPassword: false,
        canChangeEmail: false,
      });
      await expect(changePassword(owner, "new-password")).rejects.toMatchObject(
        { statusCode: 400 }
      );
      await expect(
        requestEmailChange(owner, "new@example.com", "en")
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );

  it("changes a database password through Auth0 and sends a security notice", async () => {
    await changePassword(owner, "new-password");
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
      owner,
      { password: "new-password", connection: "database" },
      expect.any(Object)
    );
    expect(mocks.state).not.toHaveProperty("password");
    expect(mocks.mail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "old@example.com",
        title: "Your password was changed",
      })
    );
  });
});
