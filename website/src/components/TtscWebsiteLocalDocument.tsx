import { compileMdx } from "nextra/compile";
import { MDXRemote } from "nextra/mdx-remote";

import getTtscWebsiteLocalSourceFile from "./internal/getTtscWebsiteLocalSourceFile";

interface TtscWebsiteLocalDocumentProps {
  path: string;
}

/**
 * Renders a workspace-local Markdown document through the same MDX pipeline as
 * the guide pages, so a document like the root README.md stays a single source
 * of truth instead of being duplicated into the docs tree.
 */
export default async function TtscWebsiteLocalDocument(
  props: TtscWebsiteLocalDocumentProps,
) {
  const content: string = await getTtscWebsiteLocalSourceFile(props.path);
  const raw: string = await compileMdx(content);
  return <MDXRemote compiledSource={raw} />;
}
