import { compileMdx } from "nextra/compile";
import { MDXRemote } from "nextra/mdx-remote";
import path from "node:path";

import getTtscWebsiteLocalSourceFile from "./internal/getTtscWebsiteLocalSourceFile";

interface TtscWebsiteLocalSourceProps {
  path: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlight?: string;
}

export default async function TtscWebsiteLocalSource(
  props: TtscWebsiteLocalSourceProps,
) {
  const content: string = await getTtscWebsiteLocalSourceFile(props.path);
  const filename: string = props.filename?.length
    ? props.filename
    : path.basename(props.path);
  const header: string = [
    `${BRACKET}typescript`,
    ` filename=${JSON.stringify(filename)}`,
    props.showLineNumbers ? " showLineNumbers" : "",
    props.highlight?.length ? ` {${props.highlight}}` : "",
  ].join("");
  const raw: string = await compileMdx(
    [header, content.trim(), BRACKET].join("\n"),
  );
  return <MDXRemote compiledSource={raw} />;
}

const BRACKET = "```";
