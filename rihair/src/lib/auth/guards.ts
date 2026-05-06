import { redirect } from "next/navigation";
import { auth } from "./index";
import type { UserRole } from "@prisma/client";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  return session;
}

export async function requireRole(...roles: UserRole[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    redirect("/");
  }
  return session;
}

export async function requireAdmin() {
  return requireRole("ADMIN", "SUPER_ADMIN");
}

export async function requireSuperAdmin() {
  return requireRole("SUPER_ADMIN");
}

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
