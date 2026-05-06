import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { requireAuth } from "@/lib/auth/guards";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pt-[calc(40px+80px)]">{children}</main>
      <SiteFooter />
    </>
  );
}
