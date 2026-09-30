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
const { resolveBash } = require("../format-go.cjs");
const { goDrift } = require("./format-check.cjs");

const root = path.resolve(__dirname, "..", "..");
const WRAPPER = path.join(root, ".vscode", "gofmt-2spaces.sh");

/** A temporary directory holding its own copy of the wrapper. */
function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-gofmt-"));
  fs.copyFileSync(WRAPPER, path.join(directory, "gofmt-2spaces.sh"));
  fs.copyFileSync(
    path.join(root, ".vscode", "gofmt-check.go"),
    path.join(directory, "gofmt-check.go"),
  );
  return directory;
}

// Use the same actual Git Bash and Perl resolution as the write and check paths.
function bash(cwd, args, options = {}) {
  const bash = resolveBash();
  return cp.spawnSync(bash.binary, ["./gofmt-2spaces.sh", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...bash.env, GOTOOLCHAIN: "local", GOWORK: "off", GOFLAGS: "" },
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

/**
 * The write path — the one `pnpm format` runs.
 *
 * `files` maps a relative path to its content. `args` defaults to every one of
 * those paths, so a case can pass a directory, or a name that does not exist,
 * instead. Returns each seeded file's content after the run.
 */
function written(files, args) {
  const directory = workspace();
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(directory, name)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(directory, name), content);
    }
    const result = bash(directory, ["-w", ...(args ?? Object.keys(files))]);
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
  // The tab sits BETWEEN the two apostrophes, which is the only position that
  // discriminates. A rune-literal arm cannot cross a newline, so a mis-lexed
  // `'t  it'` span protects exactly that one line; with no tab inside the span
  // this case passes against an implementation that matches no comment at all.
  const output = normalized(
    "package a\n\nfunc A() {\n\t// don't\tit's a comment\n\tprintln(1)\n}\n",
  );
  assert.equal(
    output,
    "package a\n\nfunc A() {\n  // don't  it's a comment\n  println(1)\n}\n",
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
    "broken.go": "package a\n\nfunc C( {\n\tprintln(3)\n}\n",
  });
  assert.equal(
    result.status,
    2,
    "gofmt's own parse-error status is what the wrapper has to report",
  );
  assert.equal(
    result.after["a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
  );
  assert.equal(
    result.after["b.go"],
    "package a\n\nfunc B() {\n  println(2)\n}\n",
  );
  // The unparseable file is normalized too, and that is the decision rather
  // than an accident: the pass runs over the files that were named, not over
  // the subset gofmt happened to accept. gofmt left this one alone, so what it
  // gets is the tab substitution and nothing else.
  assert.equal(
    result.after["broken.go"],
    "package a\n\nfunc C( {\n  println(3)\n}\n",
  );
});

test("a directory argument normalizes every file gofmt wrote under it", () => {
  // `gofmt -w` accepts a directory and writes every Go file beneath it. The
  // normalization used to run only over arguments spelled as existing `.go`
  // paths, so a directory left the whole tree tab-indented and exited 0 — the
  // silent version of the failure the case above makes loud.
  const result = written(
    {
      "sub/a.go": "package a\n\nfunc A() {\nprintln(1)\n}\n",
      "sub/deep/b.go": "package b\n\nfunc B() {\nprintln(2)\n}\n",
    },
    ["sub"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.after["sub/a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
  );
  assert.equal(
    result.after["sub/deep/b.go"],
    "package b\n\nfunc B() {\n  println(2)\n}\n",
  );
});

test("a named path that does not exist is reported, not silently skipped", () => {
  // The negative twin of the directory case. A path matching `*.go` that did not
  // exist used to be dropped from the gofmt arguments as well as from the
  // normalization, so a typo in a format command was a silent success.
  //
  // The missing name is passed ALONGSIDE a real one, which is the shape that
  // discriminates: with a missing name alone, gofmt would receive `-w` and no
  // file and reject that instead, so the case would pass against the defect.
  const result = written(
    { "a.go": "package a\n\nfunc A() {\nprintln(1)\n}\n" },
    ["a.go", "missing.go"],
  );
  assert.notEqual(result.status, 0, "a missing path has to be reported");
  assert.match(
    result.stderr,
    /missing\.go/,
    `stderr does not name the missing path: ${result.stderr}`,
  );
  assert.equal(
    result.after["a.go"],
    "package a\n\nfunc A() {\n  println(1)\n}\n",
    "the file that does exist still has to be formatted",
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

/**
 * Verifies the shared formatter keeps each source and failure independent.
 *
 * A malformed record must not hide later files or join literals across files.
 *
 * 1. Send complete files, fragments, CRLF, literal tabs and one parse failure.
 * 2. Compare every result with the original stdin path and preserve file labels.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Go and Perl processes report every source's drift/error; assertions reject truncation and wrong parse status.
 * @evidence contracts/testing.md#independent-expectations The unchanged gofmt stdin mode supplies the formatting oracle; the malformed declaration independently requires failure status two.
 * @evidence contracts/testing.md#distinguishing-cases Full files, declaration/statement fragments, CRLF and literal tabs remain separate around a failing middle record, with Unicode and newline labels.
 * @evidence contracts/testing.md#execution-ownership The existing discovered Node wrapper harness executes this named E2E entry through the typecheck runner's wrapper population.
 * @evidence contracts/e2e.md#necessary-boundary Actual Go formatting and Perl framing must agree at the process boundary; pure formatting unit calls cannot verify their serialization or exit status.
 * @evidence contracts/e2e.md#shared-execution One actual batch serves all records; the unchanged stdin executions are required independent comparator reads rather than per-record new batch producers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One owned fixture carries matching wrapper/helper sources; each stdin request is independent and the directory is removed after every result is collected.
 * @evidence contracts/e2e.md#preserved-coverage Original literal/comment/write regressions remain unchanged; this case adds framing, partial programs and failures after and before valid records.
 */
function test_gofmt_records_preserve_stdin_and_failures() {
  const directory = workspace();
  try {
    const sources = [
      RAW_STRING_TAB,
      'const value = "a\tb"\n',
      "println(1)\n",
      "package a\r\n\r\nfunc A() {}\r\n",
    ];
    const expected = sources.map(normalized);
    const records = [...sources, ...expected].map((source, index) => ({
      file: `space 한글\n${index}.go`,
      source,
    }));
    records.splice(1, 0, {
      file: "broken.go",
      source: "package a\nfunc broken( {",
    });
    const result = bash(directory, ["--check-records"], {
      input: records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    });
    assert.equal(result.status, 2, result.stderr);
    const output = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      output.map((record) => record.file),
      records.map((record) => record.file),
    );
    assert.match(output[1].error, /expected/);
    for (let index = 0; index < records.length; index++) {
      if (index === 1) continue;
      const current = records[index].source.replace(/\r\n/g, "\n");
      assert.equal(output[index].error, "");
      assert.equal(
        output[index].drift,
        expected[(index > 1 ? index - 1 : index) % sources.length] !== current,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test(
  "framed checking preserves stdin formatting and every result after a parse error",
  test_gofmt_records_preserve_stdin_and_failures,
);

/**
 * Verifies the check retains drift and every independent read/parse failure.
 *
 * 1. Check clean and unformatted files without modifying their bytes.
 * 2. Add malformed and missing inputs and require both errors and known drift.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual goDrift reads fixture files and reports format differences plus both syntax and read errors while preserving source bytes.
 * @evidence contracts/testing.md#independent-expectations Literal valid and malformed Go inputs establish their outcomes; the existing stdin path establishes the clean literal-tab file.
 * @evidence contracts/testing.md#distinguishing-cases Clean, changed, malformed and absent inputs share one request, so an early failure cannot hide the other classifications.
 * @evidence contracts/testing.md#execution-ownership The named case is registered in the existing Node wrapper E2E harness and its typecheck runner population.
 * @evidence contracts/e2e.md#necessary-boundary The real filesystem-to-Go-to-Perl check must collect file-specific errors and remain read-only; an in-process format call alone cannot establish this connection.
 * @evidence contracts/e2e.md#shared-execution Each distinct input population uses one batch; no fixture installation or per-file native producer is repeated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All files belong to one bounded fixture removed after assertions; input bytes are independently compared after success and failure.
 * @evidence contracts/e2e.md#preserved-coverage Existing write-path assertions remain; this adds complete failure collection and checks that optimization introduces no source writes.
 */
function test_gofmt_check_collects_errors_without_writes() {
  const directory = workspace();
  try {
    const good = path.join(directory, "space 한글.go");
    const bad = path.join(directory, "broken.go");
    const clean = path.join(directory, "clean.go");
    const source = "package a\n\nfunc A(){println(1)}\n";
    fs.writeFileSync(good, source);
    fs.writeFileSync(bad, "package a\nfunc broken( {");
    fs.writeFileSync(clean, normalized(RAW_STRING_TAB));
    assert.deepEqual(goDrift([good, clean]), [good]);
    assert.equal(fs.readFileSync(good, "utf8"), source);
    assert.throws(
      () => goDrift([good, bad, clean, path.join(directory, "missing.go")]),
      (error) => {
        assert.match(error.message, /broken\.go/);
        assert.match(error.message, /missing\.go/);
        assert.ok(error.message.includes(good));
        return error.errors.length === 2;
      },
    );
    assert.equal(fs.readFileSync(good, "utf8"), source);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test(
  "the read-only check reports independent drift and parse errors without rewriting files",
  test_gofmt_check_collects_errors_without_writes,
);

/**
 * Verifies custom shell selection keeps the actual formatter's behavior.
 *
 * 1. Select a shell formatter that adds a literal comment after real gofmt.
 * 2. Require the check to detect that output without changing the source.
 * 3. Check an empty population without executing the custom formatter.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual Bash selection through BASH_ENV changes formatting output; goDrift must report the custom formatter's observable difference.
 * @evidence contracts/testing.md#independent-expectations The fixture command appends a known literal comment, which independently makes the otherwise clean source differ.
 * @evidence contracts/testing.md#distinguishing-cases A custom shell function differs from the normal SDK executable; the empty population requires no producer and returns no drift.
 * @evidence contracts/testing.md#execution-ownership This named Node E2E entry is registered with the existing wrapper regression harness.
 * @evidence contracts/e2e.md#necessary-boundary The test exercises real shell command selection and process output, which a mocked SDK path comparison cannot establish.
 * @evidence contracts/e2e.md#shared-execution One fixture and formatter request cover command selection; the empty input needs no second producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity BASH_ENV is restored on every exit and its owned script/source directory is removed after the child returns.
 * @evidence contracts/e2e.md#preserved-coverage The normal SDK batch and original wrapper cases remain; this adds the independently selected formatter compatibility boundary.
 */
function test_gofmt_check_preserves_shell_selection() {
  const directory = workspace();
  const previous = process.env.BASH_ENV;
  try {
    const source = path.join(directory, "clean.go");
    const environment = path.join(directory, "environment.sh");
    fs.writeFileSync(source, "package a\n");
    fs.writeFileSync(
      environment,
      'gofmt() { command gofmt "$@"; printf "// selected formatter\\n"; }\nexport -f gofmt\n',
    );
    process.env.BASH_ENV = environment;
    assert.deepEqual(goDrift([source]), [source]);
    assert.equal(fs.readFileSync(source, "utf8"), "package a\n");
    assert.deepEqual(goDrift([]), []);
  } finally {
    if (previous === undefined) delete process.env.BASH_ENV;
    else process.env.BASH_ENV = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
test(
  "an independently selected shell formatter keeps its observable formatting",
  test_gofmt_check_preserves_shell_selection,
);

module.exports = {
  test_gofmt_records_preserve_stdin_and_failures,
  test_gofmt_check_collects_errors_without_writes,
  test_gofmt_check_preserves_shell_selection,
};
