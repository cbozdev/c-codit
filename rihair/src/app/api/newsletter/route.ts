import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let data;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = schema.parse(await request.json());
    } else {
      const form = await request.formData();
      data = schema.parse({ email: form.get("email"), name: form.get("name") });
    }

    await prisma.newsletter.upsert({
      where: { email: data.email },
      update: { isActive: true, unsubscribedAt: null },
      create: { email: data.email, name: data.name, source: "footer_form" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
}
