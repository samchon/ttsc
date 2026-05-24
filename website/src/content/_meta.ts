import type { MetaRecord } from "nextra";

const meta: MetaRecord = {
  index: {
    type: "page",
    title: "ttsc",
    display: "hidden",
    theme: {
      layout: "full",
      toc: false,
      sidebar: false,
      breadcrumb: false,
    },
  },
  docs: {
    type: "page",
    title: "📖 Guide Documents",
  },
  blog: {
    type: "page",
    title: "📝 Blog Articles",
  },
  playground: {
    type: "page",
    title: "🛝 Playground",
    theme: {
      layout: "full",
      toc: false,
      sidebar: false,
      breadcrumb: false,
    },
  },
};
export default meta;
