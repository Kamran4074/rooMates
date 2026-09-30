import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { posts, getPost, Block } from "@/content/blog";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

// Pre-renders every post at build time - static HTML is the best case for SEO.
export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) return {};
  return pageMetadata({ title: post.title, description: post.description, path: `/blog/${post.slug}`, type: "article" });
}

function renderBlock(block: Block, i: number) {
  if (block.type === "h2") return <h2 key={i} className="text-2xl font-semibold mt-10 mb-3">{block.text}</h2>;
  if (block.type === "ul")
    return (
      <ul key={i} className="list-disc pl-6 flex flex-col gap-2 my-4 text-foreground/80">
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  return <p key={i} className="text-foreground/80 leading-relaxed my-4">{block.text}</p>;
}

export default async function BlogPostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          url: `${site.url}/blog/${post.slug}`,
          publisher: { "@type": "Organization", name: site.name },
        }}
      />

      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-primary mb-8">
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>

      <p className="text-sm text-foreground/50 mb-3">
        <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
      </p>
      <h1 className="text-4xl font-bold text-secondary dark:text-foreground leading-tight mb-6">{post.title}</h1>
      <p className="text-lg text-foreground/60 mb-8">{post.description}</p>

      <div>{post.body.map(renderBlock)}</div>

      <div className="mt-14 rounded-2xl bg-primary/10 p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Try RooMates free</h2>
        <p className="text-foreground/60 mb-5">Add expenses once. Settle up in the fewest payments.</p>
        <Link href="/signup" className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark">
          Get started
        </Link>
      </div>
    </article>
  );
}
