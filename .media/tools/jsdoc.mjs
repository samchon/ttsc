/**
 * Rebuilds the completion corpus that `jsdoc/check-tag-names` publishes.
 *
 * The rule's `Hints` method sorts every known tag and labels each one by
 * asking, in order, whether it is a synonym, whether it takes a type, and
 * whether it must be empty. Reading the same four Go maps and applying the same
 * order is what keeps the clip's popup identical to what the editor receives,
 * instead of a plausible-looking list of tags.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LINTHOST = path.join(HERE, "..", "..", "packages", "lint", "linthost");

export function corpus() {
  const known = keys("rules_jsdoc.go", "knownJSDocTags");
  const typed = new Set(keys("rules_jsdoc.go", "jsdocTagsWithType"));
  const empty = new Set(keys("rules_jsdoc.go", "emptyJSDocTags"));
  const synonyms = pairs("rules_format_jsdoc.go", "jsdocTagSynonyms");
  return known.sort().map((tag) => ({
    detail: detail(tag.toLowerCase(), synonyms, typed, empty),
    insert: tag,
  }));
}

function detail(tag, synonyms, typed, empty) {
  if (synonyms.has(tag)) return `alias for @${synonyms.get(tag)}`;
  if (typed.has(tag)) return "accepts a type";
  if (empty.has(tag)) return "no content";
  return "JSDoc tag";
}

function body(file, name) {
  const text = fs.readFileSync(path.join(LINTHOST, file), "utf8");
  const start = text.indexOf(`var ${name} = map[string]`);
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  const open = text.indexOf("{", text.indexOf("{", start) + 1);
  const close = text.indexOf("\n}", open);
  return text.slice(open, close);
}

function keys(file, name) {
  return [...body(file, name).matchAll(/"([^"]+)":/g)].map((match) => match[1]);
}

function pairs(file, name) {
  return new Map(
    [...body(file, name).matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))
) {
  const all = corpus();
  process.stdout.write(`${all.length} tags\n`);
  for (const item of all.slice(0, 10)) {
    process.stdout.write(`  ${item.insert} — ${item.detail}\n`);
  }
}
