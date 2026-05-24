import Link from "next/link";

import BlogPostCard from "./BlogPostCard";
import { getPosts, getTagCounts } from "./get-posts";

export const metadata = {
  title: "Blog",
  description: "Engineering notes, releases, and deep dives from ttsc.",
};

export default async function BlogPage() {
  const [posts, tags] = await Promise.all([getPosts(), getTagCounts()]);

  return (
    <section className="ttsc-blog-list-page">
      <h1>ttsc Blog</h1>
      <p>
        Engineering notes, release essays, and practical articles about
        TypeScript-Go, compiler plugins, typed execution, linting, and the ttsc
        toolchain.
      </p>
      {tags.length ? (
        <p>
          Browse by tag:{" "}
          {tags.map((tag, index) => (
            <span key={tag.name}>
              {index ? " · " : ""}
              <Link href={`/blog/tags/${encodeURIComponent(tag.name)}`}>
                {tag.name} ({tag.count})
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      <div className="ttsc-blog-grid">
        {posts.map((post) => (
          <BlogPostCard key={post.route} post={post} />
        ))}
      </div>
    </section>
  );
}
