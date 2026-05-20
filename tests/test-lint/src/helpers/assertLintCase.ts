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
 */
export function assertAllLintCases(): void {
  const cases = listLintCases();
  assert.notEqual(cases.length, 0, "expected at least one lint fixture");
  for (const file of cases) {
    assertLintCase(file);
  }
}

/**
 * Assert that running the native lint engine on a single fixture file produces
 * exactly the diagnostics annotated in its `// expect:` comments.
 *
 * Reads the rule set from the fixture's own annotations so that adding or
 * removing a rule only requires editing the fixture — no other file changes.
 * Extra sources in the same subdirectory (e.g. `src/` fixtures for multi-file
 * rules) are gathered by `collectExtraSources`.
 *
 * @param relativeFile - File path relative to `casesRoot` (forward-slash
 *   separated, e.g. `"consistent-type-imports/violation.ts"`).
 */
export function assertLintCase(relativeFile: string): void {
  const source = fs.readFileSync(path.join(casesRoot, relativeFile), "utf8");
  const expected = TestLint.parseExpectations(source);
  const result = TestLint.run({
    name: relativeFile,
    source,
    rules: TestLint.rulesFromExpectations(expected),
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
 * separate module file (e.g. `consistent-type-imports/src/types-fixture.ts`).
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
