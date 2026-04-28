import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.users.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /users error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const user = await prisma.users.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("POST /users error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
