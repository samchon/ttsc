// Check the screen plan against the requirement sections it must account for.
//
// The backend's completeness obligation is countable: every generated accessor
// states its own address in a JSDoc `@accessor` tag, so the operation list is
// exact and `backend/testing.md` states a rule over it. The frontend's
// equivalent quantified over a set the author chose, which is a rule that
// cannot be violated, so a workspace with one journey satisfied it exactly as
// well as a workspace with forty.
//
// The denominator is the frozen corpus. The thing this has to refuse is a
// transcription of that denominator, which is why an entry counts only when it
// is a decision about one section: it names exactly one requirement identifier,
// and it names something that exists beside it. A line carrying nineteen
// identifiers is not nineteen decisions, and a page file nobody wrote is not a
// screen.
//
// It reads and never writes.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const analysis = path.join(root, "docs", "analysis");
const components = path.join(root, "packages", "frontend", "src", "components");
const wiki = path.join(root, "packages", "frontend", "wiki");
const plan = path.join(wiki, "screen-plan.md");
const omissions = path.join(wiki, "omissions.md");

/**
 * Shortest reason an omission is accepted with, in prose characters.
 *
 * Counted after every requirement identifier is removed, so the identifiers
 * cannot supply the length themselves. The guidance asks for the owner or
 * observable alternative and the condition that would make the decision false,
 * and no script can judge whether a sentence says that. What it can refuse is
 * the absence of a sentence.
 */
const REASON_CHARACTERS = 30;

/** Every regular file under one directory, in sorted path order. */
const walk = (directory) =>
  fs.existsSync(directory) === false
    ? []
    : fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
          const child = path.join(directory, entry.name);
          return entry.isDirectory() ? walk(child) : [child];
        })
        .sort();

/** The form a citation is compared in, so spelling and case do not decide. */
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/gu, "");

/** The anchor the evidence graph addresses a heading by. */
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

/**
 * Whole normalized tokens one line carries, empties dropped.
 *
 * A dot stays inside a token so `todo-page.tsx` is one name rather than two,
 * which is what lets a plan row be compared against the files that exist.
 */
const tokens = (line) =>
  new Set(
    line
      .split(/[^\w.-]+/u)
      .map(normalize)
      .filter(Boolean),
  );

const posix = (file) => path.relative(root, file).replaceAll("\\", "/");

/**
 * Requirement sections, each with the identifier it opens with.
 *
 * Fenced code is skipped, because a `##` inside a fence is a comment in an
 * example rather than a section of the specification, and the evidence graph's
 * own Markdown parser skips it for the same reason. The two populations have to
 * agree or the prose count and the claim count answer different questions.
 *
 * An H3 records the H2 above it, because a decision about a section family is
 * one decision. That is the hierarchy the graph already uses, where an
 * acknowledged parent covers its selected descendants, and without it the
 * largest subject would need 1234 separately authored exclusions for concepts a
 * browser never delivers rather than 253.
 */
const sections = () => {
  const found = [];
  for (const file of walk(analysis).filter((name) => name.endsWith(".md"))) {
    let fenced = false;
    let parent;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
      if (/^ {0,3}(?:```|~~~)/u.test(line)) {
        fenced = fenced === false;
        continue;
      }
      if (fenced) continue;
      const heading = /^(#{2,3})[ \t]+(.*\S)[ \t]*$/u.exec(line);
      if (heading === null) continue;
      const text = heading[2].replace(/[ \t]*\{#[^}]*\}[ \t]*$/u, "");
      const identifier = /^\S+/u.exec(text)?.[0] ?? text;
      // Both the bare identifier and the graph's own anchor address this
      // section, so a plan citing either is citing it.
      const keys = [normalize(identifier), normalize(slug(text))].filter(
        Boolean,
      );
      if (keys.length === 0) continue;
      const section = {
        file: posix(file),
        text,
        keys,
        parent: heading[1].length === 3 ? parent : undefined,
      };
      if (heading[1].length === 2) parent = section;
      found.push(section);
    }
  }
  return found;
};

const required = sections();
if (required.length === 0) {
  process.stderr.write(
    `No requirement section was found under ${posix(analysis)}. The corpus is the denominator, so an empty one is a broken checkout rather than a satisfied plan.\n`,
  );
  process.exit(1);
}

/** Every key any section answers to, so a stray token is not a citation. */
const known = new Map();
for (const section of required)
  for (const key of section.keys) known.set(key, section);

/** The one section an entry decides, or nothing when it decides none or many. */
const decided = (text) => {
  const named = new Set();
  for (const key of tokens(text)) {
    const section = known.get(key);
    if (section !== undefined) named.add(section);
  }
  return named.size === 1 ? [...named][0] : undefined;
};

/** Page files that exist, so a plan cannot deliver a screen nobody wrote. */
const pages = new Set(
  walk(components)
    .filter(
      (file) =>
        file.endsWith("-page.tsx") &&
        path.basename(path.dirname(file)) !== "dev",
    )
    .map((file) => path.basename(file)),
);

const lines = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/u) : [];

/**
 * Sections a plan entry delivers.
 *
 * One line, one section, one page file that exists. The existence check is what
 * separates a plan from the enumeration with a page name appended to every row.
 */
const planned = new Set();
for (const line of lines(plan)) {
  const section = decided(line);
  if (section === undefined) continue;
  const named = [...tokens(line)].some((token) =>
    [...pages].some((page) => normalize(page) === token),
  );
  if (named) planned.add(section);
}

/**
 * Sections an omission excuses.
 *
 * An entry is a block: the line naming its section plus every following line
 * that names none, so a wrapped reason is one entry rather than a fragment that
 * names nothing. The reason is measured with the identifiers removed, because
 * otherwise the identifiers pay for the length and a list of them reads as a
 * list of decisions.
 */
const excused = new Set();
{
  let open;
  const close = () => {
    if (open === undefined) return;
    const prose = open.body
      .join(" ")
      .split(/[^\w.-]+/u)
      .filter((word) => known.has(normalize(word)) === false)
      .join("");
    if (prose.replace(/[^a-z0-9]+/giu, "").length >= REASON_CHARACTERS)
      excused.add(open.section);
    open = undefined;
  };
  for (const line of lines(omissions)) {
    const section = decided(line);
    if (section !== undefined) {
      close();
      open = { section, body: [line] };
    } else if (open !== undefined && tokens(line).size !== 0) {
      if ([...tokens(line)].some((token) => known.has(token))) close();
      else open.body.push(line);
    } else close();
  }
  close();
}

const settled = (section) =>
  planned.has(section) ||
  excused.has(section) ||
  (section.parent !== undefined && excused.has(section.parent));

const missing = required.filter((section) => settled(section) === false);
const covered = required.length - missing.length;
process.stdout.write(
  `${covered}/${required.length} requirement sections are delivered by a screen or recorded as an omission.\n`,
);
if (missing.length === 0) process.exit(0);

process.stderr.write(`\n${missing.length} requirement section(s) are neither:\n`);
for (const section of missing)
  process.stderr.write(`  ${section.file} :: ${section.text}\n`);
process.stderr.write(
  [
    "",
    "An entry decides one section. It names that section's identifier and no",
    "other, so a line listing many of them decides none.",
    "",
    "A screen entry is a line in packages/frontend/wiki/screen-plan.md naming",
    "the identifier and a page file that exists under src/components.",
    "",
    "An omission is an entry in packages/frontend/wiki/omissions.md naming the",
    "identifier, what owns the requirement instead, and the condition that would",
    `make that decision false. The reason is measured with identifiers removed,`,
    `so it needs ${REASON_CHARACTERS} characters of its own. An H2 identifier`,
    "excuses its whole section family.",
    "",
  ].join("\n"),
);
process.exit(1);
