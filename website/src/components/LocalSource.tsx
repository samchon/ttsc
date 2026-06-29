import path from "node:path";

import { getLocalSourceFile } from "./internal/getLocalSourceFile";

interface LocalSourceProps {
  path: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlight?: string;
}

export const LocalSource = async (props: LocalSourceProps) => {
  const content: string = await getLocalSourceFile(props.path);
  const filename: string = props.filename?.length
    ? props.filename
    : path.basename(props.path);
  const highlights: Set<number> = parseHighlights(props.highlight);
  const lines: string[] = content.trimEnd().split(/\r?\n/);

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-lg border border-[#222834] bg-[#090b10]">
      <figcaption className="border-b border-[#1a1f29] bg-[#0c0e13] px-4 py-2 font-mono text-[11px] text-neutral-400">
        {filename}
      </figcaption>
      <pre className="max-h-[38rem] overflow-auto p-0 text-[12px] leading-5 text-neutral-200">
        <code>
          {lines.map((line, index) => {
            const lineNumber: number = index + 1;
            const highlighted: boolean = highlights.has(lineNumber);
            return (
              <span
                key={lineNumber}
                className={`block min-w-max px-4 ${
                  highlighted ? "bg-[#15343a]" : ""
                }`}
              >
                {props.showLineNumbers ? (
                  <span className="mr-4 inline-block w-10 select-none text-right text-neutral-600">
                    {lineNumber}
                  </span>
                ) : null}
                <span>{line.length ? line : " "}</span>
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
};
export default LocalSource;

function parseHighlights(input: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!input?.trim()) return out;

  for (const token of input.split(",")) {
    const [startText, endText] = token.trim().split("-");
    const start: number = Number(startText);
    const end: number = Number(endText ?? startText);
    if (
      Number.isInteger(start) === false ||
      Number.isInteger(end) === false ||
      start <= 0 ||
      end < start
    )
      continue;
    for (let line = start; line <= end; line += 1) out.add(line);
  }
  return out;
}
