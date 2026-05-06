import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { WishlistView } from "./WishlistView";

export const metadata: Metadata = { title: "Wishlist | RI Hair Collectables" };

async function getWishlist(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { wishlist: { userId } },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          basePrice: true,
          compareAtPrice: true,
          currency: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
          variants: { where: { stockQuantity: { gt: 0 } }, take: 1, select: { id: true } },
        },
      },
    },
  });
}

export default async function WishlistPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?next=/dashboard/wishlist");

  const items = await getWishlist(session.user.id);
  return <WishlistView items={items} />;
}
