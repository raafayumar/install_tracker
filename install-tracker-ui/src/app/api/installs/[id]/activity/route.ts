import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const activities = await prisma.install_activity.findMany({
      where: { comp_site_id: id },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    return NextResponse.json(activities);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("GET /activity error:", err);
    return NextResponse.json(
      { error: message, detail: stack, route: "GET /activity", comp_site_id: (await params).id },
      { status: 500 },
    );
  }
}
