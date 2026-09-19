import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * A Postgres failure here (missing column after a schema change, dead pool)
 * otherwise reaches the browser as a bare 500 with no way to tell it apart from
 * a bug in the handler. Log the driver's code/detail, and pass the SQLSTATE
 * back so it is diagnosable from the network tab without shell access.
 */
function authFailure(res: any, label: string, error: unknown, status = 500) {
  const err = error as { code?: string; message?: string; detail?: string };
  console.error(`[auth] ${label} failed:`, err?.code ?? "", err?.message, err?.detail ?? "");
  return res.status(status).json({
    message: label,
    ...(err?.code ? { code: err.code } : {}),
  });
}

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.isAuthenticated?.() && !req.session?.emailUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      let userId: string;
      if (req.session?.emailUserId) {
        userId = req.session.emailUserId;
      } else {
        userId = req.user.claims.sub;
      }
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      return authFailure(res, "Failed to fetch user", error);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password, firstName, lastName } = parsed.data;

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await authStorage.upsertUser({
        email,
        password: hashedPassword,
        firstName,
        lastName: lastName || null,
      });

      (req.session as any).emailUserId = user.id;
      req.session.save((err: any) => {
        if (err) console.error("Session save error:", err);
        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      return authFailure(res, "Failed to register", error);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password } = parsed.data;

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).emailUserId = user.id;
      req.session.save((err: any) => {
        if (err) console.error("Session save error:", err);
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
      });
    } catch (error) {
      return authFailure(res, "Failed to log in", error);
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.emailUserId = undefined;
    if (req.logout) {
      req.logout({ keepSessionInfo: false }, () => {
        req.session.destroy((err: any) => {
          if (err) console.error("Session destroy error:", err);
          res.clearCookie("connect.sid");
          res.json({ message: "Logged out" });
        });
      });
    } else {
      req.session.destroy((err: any) => {
        if (err) console.error("Session destroy error:", err);
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    }
  });
}
