import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to prevent user enumeration
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.verificationToken.upsert({
      where: { identifier_token: { identifier: email, token } },
      update: { token, expires },
      create: { identifier: email, token, expires },
    });

    // Send email via Resend (imported lazily to avoid build issues without env)
    try {
      const { sendPasswordResetEmail } = await import("@/lib/email/resend");
      await sendPasswordResetEmail({
        to: email,
        firstName: user.firstName ?? user.name?.split(" ")[0] ?? "there",
        resetUrl: `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`,
      });
    } catch (emailErr) {
      console.error("[forgot-password] email send failed:", emailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
