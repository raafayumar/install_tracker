import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activitytype } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const comments = await prisma.install_activity.findMany({
      where: { comp_site_id: id, activity_type: activitytype.COMMENT },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    return NextResponse.json(comments);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("GET /comments error:", err);
    return NextResponse.json(
      { error: message, detail: stack, route: "GET /comments", comp_site_id: (await params).id },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, user_name } = body;

    if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

    const comment = await prisma.install_activity.create({
      data: {
        comp_site_id: id,
        activity_type: activitytype.COMMENT,
        user_name: user_name || "system",
        message,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("POST /comments error:", err);
    return NextResponse.json(
      { error: message, detail: stack, route: "POST /comments", comp_site_id: (await params).id },
      { status: 500 },
    );
  }
}
