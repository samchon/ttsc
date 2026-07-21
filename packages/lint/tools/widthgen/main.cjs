// Generate the Go tables that make `displayWidth` equal Prettier's
// `getStringWidth`.
//
// The contract `packages/lint/linthost/display_width.go` and
// `website/src/content/docs/lint/format.mdx` publish is "the width Prettier
// measures", so the oracle is the installed Prettier, not a specification of
// it. A previous attempt ported `string-width` — which the issue named and
// Prettier does NOT use — and regressed Devanagari, the Hangul fillers, the
// bidi controls, and 98 astral text-presentation emoji before it was reverted.
// Reading the module the lockfile pins removes the whole class of that mistake:
// there is nothing left to be wrong about.
//
// Three values come out of `prettier/doc.mjs`:
//
//   - the `emoji-regex` pattern, rewritten over a domain Go can hold, because
//     it matches UTF-16 code units where Go strings hold runes;
//   - `narrowEmojis`, the emoji Prettier charges one column instead of two;
//   - the `isWide` and `isFullWidth` code-point sets, which are
//     `get-east-asian-width`'s W and F. Taking them from here rather than from
//     a UCD download also settles which Unicode version applies: whichever one
//     the pinned Prettier was built against.
//
// Run: node packages/lint/tools/widthgen/main.cjs

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..", "..");
const docModule = path.join(root, "node_modules", "prettier", "doc.mjs");
const output = path.join(
  root,
  "packages",
  "lint",
  "linthost",
  "width_tables_gen.go",
);

/** The pinned Prettier version, so the generated file records its own oracle. */
function prettierVersion() {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "node_modules", "prettier", "package.json"),
      "utf8",
    ),
  );
  if (typeof manifest.version !== "string")
    throw new Error("prettier/package.json has no version");
  return manifest.version;
}

/**
 * Where a UTF-16 surrogate code unit is relocated so Go can hold it.
 *
 * See {@link emojiPattern}. Plane 15's private-use area is chosen because no
 * text can arrive carrying one: the values are produced only by this mapping,
 * from units that Go's own string type cannot represent.
 */
const SURROGATE_SHIFT = 0xf0000;

/**
 * The `emoji-regex` pattern source, as a Go pattern over relocated UTF-16 code
 * units.
 *
 * JavaScript's non-`u` regex matches UTF-16 _units_, so emoji-regex spells an
 * astral emoji as a surrogate pair and, crucially, uses surrogates inside
 * character classes — `\uD83C[\uDFFB-\uDFFF]` is one high unit followed by a
 * class of low units. Combining pairs is therefore not a local rewrite: it
 * would mean parsing and restructuring the regex, which is where a
 * transcription turns into a reimplementation that can be subtly wrong.
 *
 * So the units are kept and Go is given a domain that can hold them. Go strings
 * cannot carry a lone surrogate — `string(rune(0xD83C))` is U+FFFD — so each
 * surrogate unit is relocated by {@link SURROGATE_SHIFT}, in the pattern here
 * and in the subject text at match time. The mapping is a bijection on a range
 * nothing else uses, so every construct keeps meaning exactly what it means in
 * JavaScript, and emoji-regex uses no backreference or lookaround that RE2
 * lacks.
 */
function emojiPattern(source) {
  const line = source
    .split("\n")
    .find((candidate) => candidate.trim().startsWith("return /"));
  if (line === undefined) throw new Error("emoji-regex literal not found");
  const body = line.trim().replace(/^return \//, "");
  const end = body.lastIndexOf("/");
  if (end < 0) throw new Error("emoji-regex literal is unterminated");

  return body.slice(0, end).replace(/\\u([0-9a-fA-F]{4})/g, (_whole, hex) => {
    const code = Number.parseInt(hex, 16);
    const mapped =
      code >= 0xd800 && code <= 0xdfff ? code - 0xd800 + SURROGATE_SHIFT : code;
    return `\\x{${mapped.toString(16).toUpperCase()}}`;
  });
}

/** The emoji Prettier charges one column, as their code points. */
function narrowEmojis(source) {
  const match = source.match(/var narrow_emojis_evaluate_default = "([^"]*)"/);
  if (match === null) throw new Error("narrow-emojis literal not found");
  const decoded = match[1].replace(
    /\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
    (_whole, u, x) => String.fromCodePoint(Number.parseInt(u ?? x, 16)),
  );
  return [...decoded].map((character) => character.codePointAt(0));
}

/**
 * The code points one of Prettier's width predicates accepts.
 *
 * Both are emitted by its build as a flat disjunction of `x === N` and `x >= A
 * && x <= B`, so the ranges are read straight out of the body rather than
 * re-derived from a Unicode file that may be a different version.
 */
function predicateRanges(source, name) {
  const match = source.match(
    new RegExp(`function ${name}\\(x\\) \\{\\s*return ([^;]*);`),
  );
  if (match === null) throw new Error(`${name} not found`);
  const ranges = [];
  for (const term of match[1].split("||")) {
    const single = term.match(/^\s*x === (\d+)\s*$/);
    if (single !== null) {
      const value = Number(single[1]);
      ranges.push([value, value]);
      continue;
    }
    const span = term.match(/^\s*x >= (\d+) && x <= (\d+)\s*$/);
    if (span === null) throw new Error(`unparsed ${name} term: ${term}`);
    ranges.push([Number(span[1]), Number(span[2])]);
  }
  if (ranges.length === 0) throw new Error(`${name} produced no ranges`);
  return ranges;
}

/** Sort, merge, and reject overlap, so a binary search is well defined. */
function normalize(name, ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [lo, hi] of sorted) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && lo <= previous[1])
      throw new Error(
        `${name} has overlapping ranges ${previous[0]}..${previous[1]} and ${lo}..${hi}`,
      );
    if (previous !== undefined && lo === previous[1] + 1) {
      previous[1] = hi;
      continue;
    }
    merged.push([lo, hi]);
  }
  return merged;
}

function renderRanges(name, ranges) {
  const rows = ranges
    .map(([lo, hi]) => `  {lo: 0x${hex(lo)}, hi: 0x${hex(hi)}},`)
    .join("\n");
  return `var ${name} = [...]unicodeRange{\n${rows}\n}\n\n`;
}

const hex = (value) => value.toString(16).toUpperCase().padStart(4, "0");

function main() {
  const source = fs.readFileSync(docModule, "utf8");
  const version = prettierVersion();
  const wide = normalize("isWide", predicateRanges(source, "isWide"));
  const full = normalize("isFullWidth", predicateRanges(source, "isFullWidth"));
  const narrow = normalize(
    "narrowEmojis",
    narrowEmojis(source).map((code) => [code, code]),
  );

  const go = [
    "// Code generated by packages/lint/tools/widthgen. DO NOT EDIT.",
    "//",
    `// Transcribed from prettier@${version}'s own \`getStringWidth\`, which is the`,
    "// width contract `@ttsc/lint` publishes. Regenerate when the pinned Prettier",
    "// moves: `node packages/lint/tools/widthgen/main.cjs`.",
    "",
    "package linthost",
    "",
    `const prettierWidthVersion = ${JSON.stringify(version)}`,
    "",
    "// The emoji-regex pattern Prettier substitutes before it counts, over",
    "// UTF-16 code units with surrogates relocated by surrogateShift below.",
    `const prettierEmojiPattern = ${JSON.stringify(emojiPattern(source))}`,
    "",
    "// Where a UTF-16 surrogate code unit is relocated so a Go string can hold",
    "// it. Go cannot represent a lone surrogate, and emoji-regex matches UTF-16",
    "// units rather than runes, so both the pattern above and the subject text",
    "// shift surrogates into this private-use range. Nothing else produces a",
    "// value there, so the mapping is a bijection and the match is unchanged.",
    `const surrogateShift = 0x${SURROGATE_SHIFT.toString(16).toUpperCase()}`,
    "",
    renderRanges("prettierWideRanges", wide),
    renderRanges("prettierFullWidthRanges", full),
    renderRanges("prettierNarrowEmojiRanges", narrow),
  ].join("\n");

  // Emitted already in the repository's Go style. `.vscode/gofmt-2spaces.sh` is
  // the formatting specification the tree is checked against, and a generator
  // whose output fails that check turns regeneration into a step someone has to
  // remember rather than a property of the tool.
  fs.writeFileSync(
    output,
    `${go
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\t/g, "  ")
      .trimEnd()}\n`,
  );
  process.stdout.write(
    `widthgen: prettier@${version}, ${wide.length} wide, ${full.length} fullwidth, ${narrow.length} narrow-emoji ranges\n`,
  );
}

if (require.main === module) main();

module.exports = { emojiPattern, narrowEmojis, predicateRanges };
