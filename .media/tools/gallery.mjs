/**
 * Turns published clip URLs into the two documents that consume them: the index
 * comment for the host issue, and the website's video library page.
 *
 * Generated rather than hand-written because the pairing of 42 clips to 42 rule
 * ids is exactly the kind of list that rots silently — a clip renamed in one
 * place and not the other would leave a page linking at nothing.
 *
 * Run `node gallery.mjs` for the issue index comment, or `node gallery.mjs
 * --page` for the website page.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { specs } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URLS = path.join(HERE, "..", "urls.json");

const urls = fs.existsSync(URLS)
  ? JSON.parse(fs.readFileSync(URLS, "utf8"))
  : {};
const clips = specs().filter((clip) => urls[clip.slug]);
const byFamily = new Map();
for (const clip of clips) {
  const list = byFamily.get(clip.family) ?? [];
  list.push(clip);
  byFamily.set(clip.family, list);
}

process.stdout.write(process.argv.includes("--page") ? page() : comment());

function comment() {
  const rows = clips
    .map(
      (clip) => `| \`${clip.slug}\` | \`${clip.rule}\` | ${urls[clip.slug]} |`,
    )
    .join("\n");
  return `## Index

${clips.length} clips, ${byFamily.size} families.

| Clip | Rule | URL |
| --- | --- | --- |
${rows}
`;
}

function page() {
  const sections = [...byFamily.entries()]
    .map(([family, list]) => {
      const videos = list
        .map(
          (clip) => `<figure>
  <video controls muted loop playsInline preload="none" aria-label="${clip.rule} in the editor">
    <source src="${urls[clip.slug]}" type="video/mp4" />
  </video>
  <figcaption>
    <a href="/docs/lint/rules/${clip.familySlug}">
      <code>${clip.rule}</code>
    </a>{" "}
    — ${clip.description}
  </figcaption>
</figure>`,
        )
        .join("\n\n");
      return `## ${family}\n\n${videos}`;
    })
    .join("\n\n");

  return `# Lint family videos

Two rules from each of the 21 lint families, showing what each one publishes into the editor: the code that triggers the rule, the line it reports, and the diagnostic or completion the editor receives.

The rule ids, summaries, and example code come from the [rule catalog](/docs/lint/rules). The editor pane is drawn for these clips rather than captured from a running editor, and it does not represent any particular editor's interface. For the workflow itself, see [Lint in VS Code](/docs/lint/editor).

${sections}

## Next

→ [Lint in VS Code](/docs/lint/editor) · [Rule catalog](/docs/lint/rules)
`;
}
