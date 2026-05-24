import "./blog.css";

export const metadata = {
  title: "Blog",
  description: "Engineering notes, releases, and deep dives from ttsc.",
};

export default function BlogLayout(props) {
  return <div className="ttsc-blog-page">{props.children}</div>;
}
