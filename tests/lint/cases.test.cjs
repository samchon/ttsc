// e2e rule corpus driver.
//
// Each subdirectory under `cases/` is a dedicated rule case. The
// driver:
//
//   1. Discovers every `.ts` file under `cases/<rule>/` recursively.
//   2. Parses `// expect: <rule> <severity>` annotations from the
//      source. Each annotation pins the diagnostic the rule pass MUST
//      emit on the next non-comment, non-blank line.
//   3. Spawns the real `ttsc --noEmit` against an isolated tmpdir
//      seeded with the source + a tsconfig that enables exactly the
//      annotated rules at their annotated severities.
//   4. Asserts the rendered stderr diagnostics match the annotations
//      *exactly* — no missing entries, no extra entries, line numbers
//      and severities aligned.
//
// Files whose name begins with `clean.` are treated as the inverse:
// the lint pass MUST stay quiet, regardless of which rules the file
// would otherwise activate. Their `// expect-rule: <name>` directive
// (if any) controls which rules to enable in the tsconfig — the test
// then asserts zero diagnostics.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  runLint,
  parseExpectations,
  rulesFromExpectations,
} = require("./helpers/runLint.cjs");

const casesRoot = path.resolve(__dirname, "cases");

// Two layouts are supported:
//
//   1. Flat — `cases/<rule>.ts`. The default. One file = one rule's
//      e2e check.
//   2. Subdir — `cases/<rule>/violation.ts` (+ siblings). Only used
//      when the violation depends on additional source files (e.g.
//      `consistent-type-imports` needs an importable module to live
//      next to it).
for (const entry of fs.readdirSync(casesRoot, { withFileTypes: true })) {
  const entryPath = path.join(casesRoot, entry.name);
  if (entry.isFile() && entry.name.endsWith(".ts")) {
    registerCase(entry.name.replace(/\.ts$/, ""), entryPath);
    continue;
  }
  if (!entry.isDirectory()) continue;
  for (const file of walk(entryPath)) {
    if (!file.endsWith(".ts")) continue;
    if (!isTestFixture(file)) continue; // skip auxiliary supporting files
    registerCase(entry.name, file);
  }
}

// A `.ts` file is a test fixture only if it carries at least one
// `// expect:` annotation or its basename starts with `clean.`.
// Anything else (e.g. a `src/types-fixture.ts` referenced by a
// violation case as an import target) is an auxiliary input, not a
// case in its own right.
function isTestFixture(absPath) {
  const base = path.basename(absPath);
  if (base.startsWith("clean.")) return true;
  const text = fs.readFileSync(absPath, "utf8");
  return /\/\/\s*expect:\s*[\w-]+\s+(error|warn)/.test(text);
}

function registerCase(ruleName, absPath) {
  const relPath = path.relative(casesRoot, absPath);
  const isClean = path.basename(absPath).startsWith("clean.");
  const caseName = `${ruleName} :: ${relPath}`;

  test(caseName, () => {
    const source = fs.readFileSync(absPath, "utf8");
    const expected = parseExpectations(source);
    const rules = isClean
      ? cleanFixtureRules(source, ruleName)
      : rulesFromExpectations(expected);

    if (!isClean && expected.length === 0) {
      throw new Error(
        `fixture ${relPath} declares no // expect: ... annotations; ` +
          `add at least one or rename to clean.* if it should produce no diagnostics`,
      );
    }

    const result = runLint({
      name: ruleName,
      source,
      rules,
      extraSources: discoverExtraSources(absPath),
    });

    if (isClean) {
      assert.equal(
        result.diagnostics.length,
        0,
        `clean fixture ${relPath} produced diagnostics:\n${result.stderr}`,
      );
      const hasErrorRules = Object.values(rules).some((s) => s === "error");
      if (hasErrorRules) {
        assert.equal(
          result.status,
          0,
          `clean fixture ${relPath} should exit 0 with no errors; ttsc exited ${result.status}\n${result.stderr}`,
        );
      }
      return;
    }

    // 1) Every annotated violation must surface as a diagnostic at the
    //    correct (rule, severity, line).
    for (const exp of expected) {
      const hit = result.diagnostics.find(
        (d) =>
          d.line === exp.line &&
          d.rule === exp.rule &&
          d.severity === exp.severity,
      );
      assert.ok(
        hit,
        `expected ${exp.severity} [${exp.rule}] at ${relPath}:${exp.line} but it never fired\nfull stderr:\n${result.stderr}`,
      );
    }

    // 2) No diagnostic may surface that the fixture did not annotate.
    for (const got of result.diagnostics) {
      const hit = expected.find(
        (exp) =>
          exp.line === got.line &&
          exp.rule === got.rule &&
          exp.severity === got.severity,
      );
      assert.ok(
        hit,
        `unexpected ${got.severity} [${got.rule}] at ${relPath}:${got.line} (${got.message}) — not annotated in fixture\nfull stderr:\n${result.stderr}`,
      );
    }

    // 3) Build exit code matches severity expectations: any annotated
    //    `error` means ttsc must exit non-zero; otherwise 0.
    const hasErrorAnnotations = expected.some((e) => e.severity === "error");
    if (hasErrorAnnotations) {
      assert.notEqual(
        result.status,
        0,
        `${relPath} has error-severity annotations but ttsc exited 0`,
      );
    } else {
      assert.equal(
        result.status,
        0,
        `${relPath} has only warn-severity annotations but ttsc exited ${result.status}\n${result.stderr}`,
      );
    }
  });
}

/** For a `clean.*` fixture, derive which rules to enable. The file may
 *  carry a `// expect-rule: <name>` line — if present, that rule is
 *  enabled at error severity. Otherwise we fall back to the directory
 *  name. */
function cleanFixtureRules(source, ruleName) {
  const explicit = source
    .split(/\r?\n/)
    .map((l) => l.match(/\/\/\s*expect-rule:\s*([\w-]+)/))
    .filter(Boolean)
    .map((m) => m[1]);
  const targets = explicit.length > 0 ? explicit : [ruleName];
  const out = {};
  for (const r of targets) {
    out[r] = "error";
  }
  return out;
}

// Auxiliary fixture files (e.g. modules imported by the violation
// case) live alongside violation.ts under the subdir layout
// `cases/<rule>/`. The flat layout `cases/<rule>.ts` carries no
// siblings.
function discoverExtraSources(violationPath) {
  const parent = path.dirname(violationPath);
  if (parent === casesRoot) return undefined;
  const out = {};
  for (const file of walk(parent)) {
    if (file === violationPath) continue;
    if (!file.endsWith(".ts")) continue;
    if (isTestFixture(file)) continue; // skip other test cases in the same rule dir
    const rel = path.relative(parent, file).replace(/\\/g, "/");
    out[rel] = fs.readFileSync(file, "utf8");
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}
