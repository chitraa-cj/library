import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferredLanguage(userId: string, language: string): Promise<void>;
  updateUserPreferredFontScale(userId: string, fontScale: string): Promise<void>;
  updateUserPreferences(userId: string, prefs: { preferredLanguage?: string | null; preferredAuthor?: string | null; preferredTheme?: string | null }): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPreferredLanguage(userId: string, language: string): Promise<void> {
    await db.update(users).set({ preferredLanguage: language, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserPreferredFontScale(userId: string, fontScale: string): Promise<void> {
    await db.update(users).set({ preferredFontScale: fontScale, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserPreferences(userId: string, prefs: { preferredLanguage?: string | null; preferredAuthor?: string | null; preferredTheme?: string | null }): Promise<void> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (prefs.preferredLanguage !== undefined) updateData.preferredLanguage = prefs.preferredLanguage;
    if (prefs.preferredAuthor !== undefined) updateData.preferredAuthor = prefs.preferredAuthor;
    if (prefs.preferredTheme !== undefined) updateData.preferredTheme = prefs.preferredTheme;
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
