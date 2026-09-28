import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { posts, formatDate } from "@/content/blog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Blog — Tips for splitting rent, bills & trip expenses",
  description: "Guides on splitting rent fairly, tracking shared expenses with roommates, and settling trip costs with friends.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold text-secondary dark:text-foreground mb-3">The RooMates Blog</h1>
      <p className="text-foreground/60 text-lg mb-12">Practical guides for sharing a flat, a trip, and the bills that come with them.</p>

      <div className="flex flex-col gap-5">
        {sorted.map((post) => (
          <Card as="article" key={post.slug} className="p-6 hover:shadow-lg hover:shadow-primary/5 transition-shadow">
            <p className="text-xs text-foreground/50 mb-2">
              <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
            </p>
            <h2 className="text-xl font-semibold mb-2">
              <Link href={`/blog/${post.slug}`} className="hover:text-primary">
                {post.title}
              </Link>
            </h2>
            <p className="text-foreground/60 text-sm">{post.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
