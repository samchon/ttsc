// The completeness gate for `.vscode/gofmt-2spaces.sh`.
//
// The wrapper is the repository's Go formatting specification: `pnpm format`
// writes through it and `scripts/ci/format-check.cjs` compares against it, so a
// defect in it is a defect both halves agree on and neither reports. Two such
// defects are pinned here.
//
// The first is data loss. The normalization that turns gofmt's tabs into this
// repository's two spaces used to be a whole-file substitution, which also
// rewrote a tab inside a string literal. `packages/lint` implements Prettier's
// `useTabs` and its fixtures assert tab-indented output, so those tabs are the
// thing under test; every such fixture spells the tab as a `"\t"` escape because
// a literal one did not survive the formatter.
//
// The second is a partial write. `gofmt -w` emits tabs and the normalization is
// what removes them, so a gofmt failure between the two used to abort the script
// under `set -e` and leave every file gofmt had already written tab-indented.

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const WRAPPER = path.join(root, ".vscode", "gofmt-2spaces.sh");

/** A temporary directory holding its own copy of the wrapper. */
function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-gofmt-"));
  fs.copyFileSync(WRAPPER, path.join(directory, "gofmt-2spaces.sh"));
  return directory;
}

// `shell: true` because `bash` resolves through a shim on Windows, where a bare
// spawn fails with ENOENT rather than running the command. This mirrors how
// `scripts/ci/format-check.cjs` invokes the same script.
function bash(cwd, args, options = {}) {
  return cp.spawnSync("bash", ["./gofmt-2spaces.sh", ...args], {
    cwd,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
    ...options,
  });
}

/** The stdin path — the one the CI format gate compares every file against. */
function normalized(source) {
  const directory = workspace();
  try {
    const result = bash(directory, [], { input: source });
    assert.equal(
      result.status,
      0,
      `the wrapper exited ${result.status}:\n${result.stderr ?? ""}`,
    );
    return result.stdout.replace(/\r\n/g, "\n");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/** The write path — the one `pnpm format` runs. Returns each file's content. */
function written(files) {
  const directory = workspace();
  try {
    for (const [name, content] of Object.entries(files))
      fs.writeFileSync(path.join(directory, name), content);
    const result = bash(directory, ["-w", ...Object.keys(files)]);
    const after = {};
    for (const name of Object.keys(files))
      after[name] = fs
        .readFileSync(path.join(directory, name), "utf8")
        .replace(/\r\n/g, "\n");
    return { status: result.status, stderr: result.stderr ?? "", after };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

/** A source whose only tab is inside a raw string literal. */
const RAW_STRING_TAB =
  "package a\n" +
  "\n" +
  "const Fixture = `if (a)\n" +
  "\tx();\n" +
  "`\n" +
  "\n" +
  "func A() {\n" +
  "\tprintln(Fixture)\n" +
  "}\n";

test("a tab inside a raw string literal is data and survives the wrapper", () => {
  const output = normalized(RAW_STRING_TAB);
  assert.match(
    output,
    /`if \(a\)\n\tx\(\);\n`/,
    "the tab a fixture asserts was rewritten into spaces",
  );
});

test("a tab gofmt emitted as indentation becomes two spaces", () => {
  // The negative twin of the case above, in the same source: one tab is data
  // and the other is layout, and the wrapper has to tell them apart. Asserting
  // this on unindented input also proves the wrapper transforms rather than
  // round-trips, because the input and the output differ.
  const output = normalized("package a\n\nfunc A() {\nprintln(1)\n}\n");
  assert.equal(output, "package a\n\nfunc A() {\n  println(1)\n}\n");
});

test("a tab inside an interpreted string literal survives the wrapper", () => {
  const output = normalized('package a\n\nconst Fixture = "a\tb"\n');
  assert.equal(output, 'package a\n\nconst Fixture = "a\tb"\n');
});

test("a backtick inside a comment does not open a raw string literal", () => {
  // The shape that makes a literal-aware normalization dangerous. An unpaired
  // backtick in a comment would open a raw string that runs to the next
  // backtick anywhere in the file, protecting every tab between them — and in
  // the write path those tabs are gofmt's own indentation, so the region would
  // be left tab-indented and the format gate would fail on it. Comments are
  // matched for exactly this reason.
  const output = normalized(
    "package a\n" +
      "\n" +
      "func A() {\n" +
      "\t// the ` character, unpaired\n" +
      "\tprintln(1)\n" +
      "}\n" +
      "\n" +
      "const Fixture = `x`\n",
  );
  assert.equal(
    output,
    "package a\n" +
      "\n" +
      "func A() {\n" +
      "  // the ` character, unpaired\n" +
      "  println(1)\n" +
      "}\n" +
      "\n" +
      "const Fixture = `x`\n",
  );
});

test("an apostrophe inside a comment does not open a rune literal", () => {
  const output = normalized(
    "package a\n\nfunc A() {\n\t// don't, it's a comment\n\tprintln(1)\n}\n",
  );
  assert.equal(
    output,
    "package a\n\nfunc A() {\n  // don't, it's a comment\n  println(1)\n}\n",
  );
});

test("a tab inside a comment is normalized, because gofmt owns comment layout", () => {
  // The boundary the rule above stops at, stated so the decision is explicit
  // rather than incidental: a comment is matched to keep its quotes from
  // opening a literal, not to protect its content.
  const output = normalized("package a\n\n// a\tb\nfunc A() {}\n");
  assert.equal(output, "package a\n\n// a  b\nfunc A() {}\n");
});

test("normalizing the wrapper's own output changes nothing", () => {
  const once = normalized(RAW_STRING_TAB);
  assert.equal(normalized(once), once);
});

test("a gofmt failure still leaves the files it wrote normalized", () => {
  const result = written({
    "a.go": "package a\n\nfunc A() {\nprintln(1)\n}\n",
    "b.go": "package a\n\nfunc B() {\nprintln(2)\n}\n",
    "broken.go": "package a\n\nfunc C( {\n",
  });
  assert.notEqual(
    result.status,
    0,
    "an unparseable file has to be reported, not swallowed",
  );
  assert.equal(
    result.after["a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
  );
  assert.equal(
    result.after["b.go"],
    "package a\n\nfunc B() {\n  println(2)\n}\n",
  );
  assert.equal(
    result.after["broken.go"],
    "package a\n\nfunc C( {\n",
    "gofmt cannot format what it cannot parse, so the file stays as written",
  );
});

test("the write path and the stdin path produce the same bytes", () => {
  // `pnpm format` writes through one path and `scripts/ci/format-check.cjs`
  // compares against the other. If they ever disagree, the gate reports drift on
  // a tree the format command just produced.
  const result = written({ "a.go": RAW_STRING_TAB });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.after["a.go"], normalized(RAW_STRING_TAB));
});

test("an aligned block keeps its alignment when a value carries a tab", () => {
  // gofmt aligns with tabs through a tabwriter, and a literal tab inside a value
  // sits in the same byte stream. Preserving literal tabs must not make the
  // alignment tabs unrecognizable.
  const output = normalized(
    "package a\n\nconst (\n\ta = `x\ty`\n\tbb = 1\n)\n",
  );
  assert.match(output, /`x\ty`/, "the literal tab was rewritten");
  assert.doesNotMatch(
    output.replace(/`x\ty`/, "``"),
    /\t/,
    "an alignment tab survived into the output",
  );
});
