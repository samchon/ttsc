/**
 * Reads the checked rule catalog and returns every rule that documents a
 * runnable example.
 *
 * The website pages are the only place where a rule id, its summary, a
 * compiling example, and the exact line the rule reports on all live together
 * and are kept honest by review. Deriving clip content from them means a clip
 * can never claim a rule reports something it does not.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.join(
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

/** Families whose examples need a `.tsx` surface rather than `.ts`. */
const TSX_FAMILIES = new Set([
  "jsx-a11y",
  "nextjs",
  "react",
  "react-perf",
  "solid",
  "storybook",
]);

export function families() {
  return fs
    .readdirSync(RULES_DIR)
    .filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
    .map((name) => read(path.join(RULES_DIR, name)))
    .filter((family) => family.rules.length > 0);
}

function read(file) {
  const slug = path.basename(file, ".mdx");
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? slug;
  const indexed = new Map();
  for (const match of text.matchAll(/^- \[`([^`]+)`\]\([^)]*\):\s*(.+)$/gm)) {
    indexed.set(match[1], match[2].trim());
  }

  const rules = [];
  const sections = text.split(/^### /m).slice(1);
  for (const section of sections) {
    const id = /^`([^`]+)`/.exec(section)?.[1];
    if (!id || !indexed.has(id)) continue;
    const example = /```tsx?\n([\s\S]*?)```/.exec(section)?.[1];
    if (!example) continue;
    const lines = example.replace(/\n+$/, "").split("\n");
    const marker = lines.findIndex((line) =>
      new RegExp(`^\\s*// reports: ${escapeRegExp(id)}\\b`).test(line),
    );
    if (marker < 0 || marker + 1 >= lines.length) continue;
    rules.push({
      autofixable: /\bAutofixable\b/.test(section),
      bad: lines[marker + 1],
      code: lines.filter((_, index) => index !== marker).join("\n"),
      description: indexed.get(id),
      family: title,
      familySlug: slug,
      file: TSX_FAMILIES.has(slug) ? "src/app.tsx" : "src/main.ts",
      rule: id,
      typeAware: /Type-aware via the Checker/.test(section),
    });
  }
  return { rules, slug, title, total: indexed.size };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const all = families();
  for (const family of all) {
    process.stdout.write(
      `${family.slug}: ${family.rules.length} rules with examples\n`,
    );
  }
  process.stdout.write(
    `total ${all.reduce((sum, family) => sum + family.rules.length, 0)}\n`,
  );
}
