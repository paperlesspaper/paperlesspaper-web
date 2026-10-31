import jwt, { type JwtPayload } from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { ApiError } from "@internetderdinge/api";

let client: ReturnType<typeof jwksRsa>;
let clientDomain: string;

// Accept only a signed, recent ID token for the same subject AND application
// as the authenticated access token. prompt=login alone is not proof.
export async function verifyRecentLogin(
  token: string,
  subject: string,
  audience: string
) {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain || !audience)
    throw new ApiError(401, "Please sign in again to continue.");
  if (!client || clientDomain !== domain) {
    client = jwksRsa({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });
    clientDomain = domain;
  }
  try {
    const claims = await new Promise<JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          if (!header.kid) return callback(new Error("Missing key ID"));
          client.getSigningKey(header.kid).then(
            (key) => callback(null, key.getPublicKey()),
            () => callback(new Error("Unable to verify signing key"))
          );
        },
        {
          algorithms: ["RS256"],
          issuer: `https://${domain}/`,
          audience,
          subject,
        },
        (error, value) => {
          if (error || !value || typeof value === "string")
            reject(error || new Error("Invalid token"));
          else resolve(value);
        }
      );
    });
    const now = Date.now() / 1000;
    if (
      typeof claims.auth_time !== "number" ||
      claims.auth_time < now - 300 ||
      claims.auth_time > now + 30 ||
      typeof claims.exp !== "number" ||
      (claims.azp && claims.azp !== audience)
    ) {
      throw new Error("Recent authentication required");
    }
  } catch {
    throw new ApiError(401, "Please sign in again to continue.");
  }
}
