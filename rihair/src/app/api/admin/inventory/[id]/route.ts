import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({ stockQuantity: z.number().int().min(0) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { stockQuantity } = schema.parse(await request.json());

  const variant = await prisma.productVariant.update({
    where: { id },
    data: { stockQuantity },
  });

  return NextResponse.json(variant);
}
