import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Test raw DB connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.db_connection = "ok";
  } catch (err) {
    results.db_connection = { error: String(err) };
    return NextResponse.json({ status: "error", ...results }, { status: 503 });
  }

  // 2. Table counts via Prisma ORM
  const tables = ["installs", "users", "install_activity", "site_stage_history", "stage_snapshots"] as const;
  results.table_counts = {};
  for (const table of tables) {
    try {
      (results.table_counts as Record<string, unknown>)[table] = await (prisma as any)[table].count();
    } catch (err) {
      (results.table_counts as Record<string, unknown>)[table] = { error: String(err) };
    }
  }

  // 3. Test install_activity specifically with raw SQL (bypasses Prisma enum mapping)
  try {
    const rawActivities = await prisma.$queryRaw`
      SELECT id, comp_site_id, user_name, activity_type::text, message, created_at
      FROM install_activity
      ORDER BY created_at DESC
      LIMIT 3
    `;
    results.raw_activity_query = rawActivities;
  } catch (err) {
    results.raw_activity_query = { error: String(err) };
  }

  // 4. Test install_activity via Prisma ORM (this is what the comments/activity routes use)
  try {
    const ormActivity = await prisma.install_activity.findFirst({
      orderBy: { created_at: "desc" },
    });
    results.orm_activity_query = ormActivity || "no rows";
  } catch (err) {
    results.orm_activity_query = { error: String(err) };
  }

  // 5. Check the actual PostgreSQL enum values
  try {
    const enumValues = await prisma.$queryRaw`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'activitytype'
      ORDER BY enumsortorder
    `;
    results.db_activitytype_enum = enumValues;
  } catch (err) {
    results.db_activitytype_enum = { error: String(err) };
  }

  // 6. Check pipelinetype enum too (for comparison - this one works)
  try {
    const enumValues = await prisma.$queryRaw`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'pipelinetype'
      ORDER BY enumsortorder
    `;
    results.db_pipelinetype_enum = enumValues;
  } catch (err) {
    results.db_pipelinetype_enum = { error: String(err) };
  }

  const hasErrors = Object.values(results).some(
    (v) => typeof v === "object" && v !== null && "error" in (v as Record<string, unknown>)
  );

  return NextResponse.json({
    status: hasErrors ? "partial_errors" : "ok",
    ...results,
  });
}
