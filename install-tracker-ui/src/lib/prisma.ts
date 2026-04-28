/**
 * Prisma singleton — prevents multiple PrismaClient instances during dev hot-reload.
 *
 * HOW TO MODIFY:
 * - To add query logging in dev, change the `log` array to include "query".
 * - The DATABASE_URL env var is set in .env (local) or docker-compose.yml (prod).
 * - After changing prisma/schema.prisma, run: npx prisma generate
 */

import { PrismaClient } from "@prisma/client";

// Store the client on globalThis to survive hot-module-replacement in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
