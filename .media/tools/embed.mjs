/**
 * Puts each clip in the rule page it documents.
 *
 * A clip belongs beside its own rule, not in a gallery a reader has to go find:
 * the person who needs it is already reading that rule's section. The insert
 * point is directly after the rule's example, because the clip shows that
 * example being reported.
 *
 * Idempotent. An existing block for the same rule is replaced rather than
 * duplicated, so this can run again after a re-render or a re-upload.
 *
 * Run `node embed.mjs` to write the pages, `node embed.mjs --check` to report
 * what would change without touching them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { specs } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES = path.join(
  HERE,
  "..",
  "..",
  "website",
  "src",
  "content",
  "docs",
  "lint",
  "rules",
);
const URLS = path.join(HERE, "..", "urls.json");

/** A previously inserted block, so a rerun replaces instead of stacking. */
const BLOCK = /\n<figure className="rule-clip">[\s\S]*?<\/figure>\n/g;

const urls = JSON.parse(fs.readFileSync(URLS, "utf8"));
const check = process.argv.includes("--check");

const byFamily = new Map();
for (const clip of specs()) {
  if (!urls[clip.slug]) continue;
  const list = byFamily.get(clip.familySlug) ?? [];
  list.push(clip);
  byFamily.set(clip.familySlug, list);
}

let written = 0;
const missing = [];
for (const [family, clips] of byFamily) {
  const file = path.join(RULES, `${family}.mdx`);
  let text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const clip of clips) {
    const next = insert(text, clip, urls[clip.slug]);
    if (next === null) {
      missing.push(`${clip.rule} (no section or example in ${family}.mdx)`);
      continue;
    }
    text = next;
  }
  if (!check) fs.writeFileSync(file, text, "utf8");
  written++;
}

process.stdout.write(`${check ? "checked" : "wrote"} ${written} rule pages\n`);
for (const gap of missing) process.stdout.write(`MISSING ${gap}\n`);
if (missing.length) process.exitCode = 1;

/**
 * Place one clip after its rule's example fence.
 *
 * The section is bounded by the next `###` heading so a rule cannot borrow the
 * example of the rule below it — the pages list rules in catalog order, and
 * several neighbouring sections open with the same prose.
 */
function insert(text, clip, url) {
  const heading = `### \`${clip.rule}\`\n`;
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const after = start + heading.length;
  const nextHeading = text.indexOf("\n### ", after);
  const end = nextHeading < 0 ? text.length : nextHeading;
  const section = text.slice(after, end);

  const stripped = section.replace(BLOCK, "");
  const fence = lastFenceEnd(stripped);
  if (fence < 0) return null;

  const block = `\n${video(clip, url)}\n`;
  return (
    text.slice(0, after) +
    stripped.slice(0, fence) +
    block +
    stripped.slice(fence) +
    text.slice(end)
  );
}

function lastFenceEnd(section) {
  const fences = [...section.matchAll(/```[\s\S]*?```\n/g)];
  if (fences.length === 0) return -1;
  const last = fences[fences.length - 1];
  return last.index + last[0].length;
}

function video(clip, url) {
  const shows = clip.completion
    ? "the completion this rule publishes"
    : "the diagnostic this rule reports";
  return `<figure className="rule-clip">
  <video
    controls
    muted
    loop
    playsInline
    preload="none"
    aria-label="${clip.rule}: ${shows}"
  >
    <source src="${url}" type="video/mp4" />
  </video>
</figure>`;
}
