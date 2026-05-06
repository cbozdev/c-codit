import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Blog | RI Hair Collectables",
  description: "Hair care tips, styling guides, and the latest from RI Hair Collectables.",
};

export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      readingTimeMinutes: true,
      tags: true,
    },
    take: 24,
  });

  return (
    <div className="bg-[#FAFAF8] py-20">
      <div className="container-brand max-w-5xl">
        <div className="text-center mb-14">
          <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
            Knowledge & Inspiration
          </p>
          <h1 className="font-cormorant text-5xl font-semibold text-[#0A0A0A]">
            The RI Hair Journal
          </h1>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-400">Blog posts coming soon. Stay tuned.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="card-elevated overflow-hidden group"
              >
                {post.coverImage ? (
                  <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-[#C9A84C]/10 to-neutral-100 flex items-center justify-center">
                    <span className="font-cormorant text-2xl text-[#C9A84C]/30">RI Hair</span>
                  </div>
                )}
                <div className="p-5">
                  {post.tags && (post.tags as string[]).length > 0 && (
                    <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider mb-2">
                      {(post.tags as string[])[0]}
                    </p>
                  )}
                  <h2 className="font-cormorant text-xl font-semibold text-[#0A0A0A] mb-2 line-clamp-2 group-hover:text-[#C9A84C] transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{post.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    {post.publishedAt && (
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {post.readingTimeMinutes && (
                      <>
                        <span>·</span>
                        <span>{post.readingTimeMinutes} min read</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
