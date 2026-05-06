import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug, isPublished: true },
    select: { title: true, excerpt: true, coverImage: true },
  });

  if (!post) return { title: "Post Not Found" };

  return {
    title: `${post.title} | RI Hair Blog`,
    description: post.excerpt ?? undefined,
    openGraph: post.coverImage ? { images: [post.coverImage] } : undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { slug, isPublished: true },
    select: {
      title: true,
      content: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      readingTimeMinutes: true,
      tags: true,
      authorName: true,
    },
  });

  if (!post) notFound();

  return (
    <div className="bg-[#FAFAF8] py-16">
      <div className="container-brand max-w-2xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-[#0A0A0A] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        {post.coverImage && (
          <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-8">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {post.tags && (post.tags as string[]).length > 0 && (
          <div className="flex gap-2 mb-4">
            {(post.tags as string[]).map((tag) => (
              <span
                key={tag}
                className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="font-cormorant text-4xl md:text-5xl font-semibold text-[#0A0A0A] mb-4 leading-tight">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-neutral-400 mb-8">
          {post.authorName && <span>By {post.authorName}</span>}
          {post.publishedAt && (
            <>
              {post.authorName && <span>·</span>}
              <span>
                {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </>
          )}
          {post.readingTimeMinutes && (
            <>
              <span>·</span>
              <span>{post.readingTimeMinutes} min read</span>
            </>
          )}
        </div>

        <div
          className="prose prose-neutral max-w-none prose-headings:font-cormorant prose-headings:font-semibold prose-a:text-[#C9A84C]"
          dangerouslySetInnerHTML={{ __html: post.content ?? post.excerpt ?? "" }}
        />
      </div>
    </div>
  );
}
