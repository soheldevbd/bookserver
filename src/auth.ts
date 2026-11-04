import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Verifies the JWT issued by BetterAuth (jwt plugin) on the Next.js app.
 * Public keys come from <AUTH_URL>/api/auth/jwks.
 */
export const verifyJwt: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: token missing" });
    }
    const authUrl = (process.env.AUTH_URL || "").replace(/\/$/, "");
    if (!authUrl) throw new Error("AUTH_URL is not set");
    jwks ??= createRemoteJWKSet(new URL(`${authUrl}/api/auth/jwks`));

    const { payload } = await jwtVerify(header.slice(7), jwks, {
      issuer: authUrl,
      audience: authUrl,
    });
    const email = payload.email;
    if (typeof email !== "string") {
      return res.status(401).json({ message: "Unauthorized: invalid token payload" });
    }
    const user: AuthUser = {
      id: String(payload.sub ?? payload.id ?? ""),
      email,
      name: typeof payload.name === "string" ? payload.name : "",
    };
    res.locals.user = user;
    next();
  } catch (err) {
    console.error("JWT error:", (err as Error).message);
    res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
};

export const currentUser = (res: Response) => res.locals.user as AuthUser;
