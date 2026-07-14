import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Absolute path to the `src/cases` tree relative to the test-lint package. */
const casesRoot = path.join(process.cwd(), "src", "cases");

/**
 * Discover and assert every annotated lint fixture under `src/cases`.
 *
 * Iterates all `.ts` files in the cases tree that contain at least one `//
 * expect:` annotation and delegates to `assertLintCase` for each. Fails
 * immediately if the corpus is empty (guards against accidental tree-removal).
 *
 * A fixture may opt out with a `// @ttsc-corpus-skip: <reason>` directive on
 * the first non-blank line. The reason is required and acts as the inline
 * docstring for the exclusion. Skipped fixtures are still required to live in
 * the tree (their Go-side rule corpus test stays the source of truth).
 *
 * The corpus is the single heaviest lint scenario, so CI runs it as a handful
 * of parallel partitions: pass `{ index, total }` and this asserts only the `i
 * % total === index` slice of the (evenly costed) fixtures. The empty-corpus
 * guard still checks the full discovered tree in every partition.
 */
export function assertAllLintCases(partition?: {
  index: number;
  total: number;
}): void {
  const cases = listLintCases();
  assert.notEqual(cases.length, 0, "expected at least one lint fixture");
  const selected = partition
    ? cases.filter((_, i) => i % partition.total === partition.index)
    : cases;
  for (const file of selected) {
    assertLintCase(file);
  }
}

/**
 * Assert that running the native lint engine on a single fixture file produces
 * exactly the diagnostics annotated in its `// expect:` comments.
 *
 * Reads the rule set from the fixture's own annotations so that adding or
 * removing a rule only requires editing the fixture — no other file changes. A
 * rule that needs options carries them in a `// @ttsc-corpus-options: <rule>
 * <json>` directive, which upgrades that rule's config entry to the `[severity,
 * options]` tuple (see `applyCorpusOptions`). Extra sources in the same
 * subdirectory (e.g. `src/` fixtures for multi-file rules) are gathered by
 * `collectExtraSources`.
 *
 * Honors the `// @ttsc-corpus-skip: <reason>` directive: a fixture marked with
 * one is loaded and validated against the directive shape but the native lint
 * run is skipped — useful for rules whose contract requires project-level
 * inputs the flat corpus runner does not synthesize (a `src/pages/...` path, a
 * sibling `package.json`).
 *
 * Honors the `// @ttsc-corpus-filename: <path>` directive: the fixture is
 * materialized at the given project-root-relative path (under `src/`) instead
 * of the default `src/main.ts`, so path-sensitive rules (filename
 * conventions, directory layouts) can carry their logical filename while the
 * on-disk fixture keeps a corpus-friendly name.
 *
 * @param relativeFile - File path relative to `casesRoot` (forward-slash
 *   separated, e.g. `"consistentTypeImports/violation.ts"`).
 */
export function assertLintCase(relativeFile: string): void {
  const source = fs.readFileSync(path.join(casesRoot, relativeFile), "utf8");
  const skip = parseCorpusSkip(source);
  if (skip !== null) {
    assert.notEqual(
      skip.length,
      0,
      `${relativeFile}: \`// @ttsc-corpus-skip:\` requires a non-empty reason`,
    );
    return;
  }
  const expected = TestLint.parseExpectations(source);
  const result = TestLint.run({
    name: relativeFile,
    source,
    sourcePath: parseCorpusFilename(source, relativeFile),
    rules: applyCorpusOptions(
      relativeFile,
      source,
      TestLint.rulesFromExpectations(expected),
    ),
    extraSources: collectExtraSources(relativeFile),
  });

  assert.notEqual(
    result.status,
    0,
    `${relativeFile} should report lint diagnostics.\n${result.stderr}`,
  );
  assert.deepEqual(
    result.diagnostics.map(({ rule, severity, line }) => ({
      rule,
      severity,
      line,
    })),
    expected.map(({ rule, severity, line }) => ({ rule, severity, line })),
    result.stderr,
  );
}

/**
 * Merge `// @ttsc-corpus-options: <rule> <json>` directives into the rules map
 * parsed from the fixture's `// expect:` annotations. Each directive turns the
 * named rule's severity into the `[severity, options]` tuple the lint config
 * format accepts, so option-bearing rules (e.g. `unicorn/string-content`, which
 * reports nothing without configured patterns) can run through the same flat
 * corpus as default-configured ones.
 *
 * A directive naming a rule without any expectation is a fixture bug: the
 * options would silently configure nothing, so it fails loudly. The Go rule
 * corpus helper (`newRuleCorpusEngine`) parses the identical directive.
 */
function applyCorpusOptions(
  relativeFile: string,
  source: string,
  rules: Record<string, TestLint.LintRuleConfigEntry>,
): Record<string, TestLint.LintRuleConfigEntry> {
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(
      /^\s*\/\/\s*@ttsc-corpus-options:\s*(\S+)\s+(\S.*?)\s*$/,
    );
    if (!match) continue;
    const [, rule, payload] = match;
    if (!rule || !payload) continue;
    const severity = rules[rule];
    assert.notEqual(
      severity,
      undefined,
      `${relativeFile}: @ttsc-corpus-options names ${rule}, which has no // expect: annotation`,
    );
    assert.ok(
      typeof severity === "string",
      `${relativeFile}: duplicate @ttsc-corpus-options directive for ${rule}`,
    );
    let options: unknown;
    try {
      options = JSON.parse(payload);
    } catch (error) {
      throw new Error(
        `${relativeFile}: @ttsc-corpus-options for ${rule} carries invalid JSON: ${payload}`,
        { cause: error },
      );
    }
    rules[rule] = [severity, options];
  }
  return rules;
}

/**
 * Read the first `// @ttsc-corpus-skip: <reason>` directive from the source, if
 * any. Returns the reason string (possibly empty — assertLintCase rejects empty
 * reasons), or `null` when the directive is absent.
 *
 * The directive may appear on any line; it is not required to be the first
 * line. Callers iterate the fixture tree once, so a linear scan is fine.
 */
function parseCorpusSkip(source: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*\/\/\s*@ttsc-corpus-skip:\s*(.*?)\s*$/);
    if (match) {
      return match[1] ?? "";
    }
  }
  return null;
}

/**
 * Read the first `// @ttsc-corpus-filename: <path>` directive from the
 * source, if any. Returns the project-root-relative path the fixture should
 * be materialized at, or `undefined` to use the harness default
 * (`src/main.ts`). Path validation (must stay under `src/`) is owned by
 * `TestLint`.
 */
function parseCorpusFilename(
  source: string,
  relativeFile: string,
): string | undefined {
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*\/\/\s*@ttsc-corpus-filename:\s*(.*?)\s*$/);
    if (match) {
      assert.notEqual(
        (match[1] ?? "").length,
        0,
        `${relativeFile}: \`// @ttsc-corpus-filename:\` requires a path`,
      );
      return match[1];
    }
  }
  return undefined;
}

/**
 * List all annotated lint fixture files (those with at least one `// expect:`
 * annotation) under `casesRoot`, as forward-slash paths relative to that root.
 */
function listLintCases(): string[] {
  return walk(casesRoot)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => path.relative(casesRoot, file).replaceAll(path.sep, "/"))
    .filter((file) => {
      const source = fs.readFileSync(path.join(casesRoot, file), "utf8");
      return TestLint.parseExpectations(source).length !== 0;
    });
}

/**
 * Gather sibling files from the same subdirectory as `relativeFile` to pass as
 * extra sources. Used for rules that need a companion type-declaration or
 * separate module file (e.g. `consistentTypeImports/src/types-fixture.ts`).
 *
 * Returns an empty object when the fixture sits directly under `casesRoot`
 * (i.e. no subdirectory companion files are expected).
 *
 * @param relativeFile - File path relative to `casesRoot`.
 */
function collectExtraSources(relativeFile: string): Record<string, string> {
  const dir = path.dirname(relativeFile);
  if (dir === ".") return {};
  const root = path.join(casesRoot, dir);
  const out: Record<string, string> = {};
  for (const file of walk(root)) {
    const rel = path.relative(root, file).replaceAll(path.sep, "/");
    if (rel === path.basename(relativeFile)) continue;
    out[path.posix.join("src", rel)] = fs.readFileSync(file, "utf8");
  }
  return out;
}

/**
 * Recursively enumerate all files under `dir`, sorted for deterministic
 * ordering across platforms.
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.isFile()) out.push(file);
  }
  return out.sort();
}
