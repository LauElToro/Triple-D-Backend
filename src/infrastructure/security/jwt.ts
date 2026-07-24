import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const accessKey = new TextEncoder().encode(env.jwtAccessSecret);

export interface AccessTokenClaims {
  sub: string; // userId
  systemRole: string;
  email: string;
  twoFactorPending?: boolean;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("set-api")
    .setExpirationTime(`${env.accessTokenTtlSeconds}s`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, { issuer: "set-api" });
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}
