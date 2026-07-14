import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Absolute path to the `src/cases` tree relative to the test-lint package. */
const casesRoot = path.join(process.cwd(), "src", "cases");
const repoRoot = path.resolve(casesRoot, "../../../..");
const harnessRoot = path.join(repoRoot, "packages", "lint", "test");
const positiveHarnessPathPattern =
  /\bpackages\/lint\/test\/[\w./-]+_test\.go\b/g;
const corpusSkipManifestPath = path.join(
  harnessRoot,
  "registry",
  "behavioral_witness_exclusions.json",
);
type CorpusConstraint =
  | "options"
  | "filename"
  | "project"
  | "checker"
  | "platform";

const corpusConstraintNames: ReadonlySet<CorpusConstraint> = new Set([
  "options",
  "filename",
  "project",
  "checker",
  "platform",
]);

interface CorpusSkipDirective {
  constraint: string | null;
  reason: string;
}

interface CorpusSkipManifestEntry {
  rule: string;
  constraint: CorpusConstraint;
  harness: string;
}

const corpusSkipManifest = loadCorpusSkipManifest();

/**
 * Discover and assert every annotated lint fixture under `src/cases`.
 *
 * Iterates all `.ts` and `.tsx` files in the cases tree that contain an
 * expectation or corpus-skip directive and delegates to `assertLintCase` for
 * each. Fails immediately if the corpus is empty.
 *
 * A fixture may opt out with one
 * `// @ttsc-corpus-skip(<constraint>): <reason>` directive. Its rule,
 * constraint, and Go harness must match the mechanically audited manifest.
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
  validateCorpusSkipManifestCoverage(cases);
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
 * Honors the audited `// @ttsc-corpus-skip(<constraint>): <reason>` directive:
 * a matching fixture is validated but its flat native run is skipped. The
 * referenced Go harness still has to prove the same rule and constraint through
 * production dispatch.
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
  const skip = parseCorpusSkip(relativeFile, source);
  if (skip !== null) {
    validateCorpusSkip(relativeFile, source, skip);
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

function validateCorpusSkip(
  relativeFile: string,
  source: string,
  skip: CorpusSkipDirective,
): string {
  assert.notEqual(
    skip.reason.length,
    0,
    `${relativeFile}: a corpus-skip directive requires a non-empty reason`,
  );
  assert.equal(
    /not yet implemented/i.test(source),
    false,
    `${relativeFile}: a public rule cannot skip the corpus as "not yet implemented"`,
  );
  assert.ok(
    isCorpusConstraint(skip.constraint),
    `${relativeFile}: unknown corpus constraint ${JSON.stringify(skip.constraint)}`,
  );

  const replacements = skip.reason.match(positiveHarnessPathPattern) ?? [];
  assert.equal(
    replacements.length,
    1,
    `${relativeFile}: a corpus skip must reference exactly one positive Go harness under packages/lint/test/`,
  );
  const replacement = replacements[0] as string;
  const replacementPath = path.resolve(repoRoot, replacement);
  const relativeHarnessPath = path.relative(harnessRoot, replacementPath);
  assert.equal(
    relativeHarnessPath.startsWith("..") ||
      path.isAbsolute(relativeHarnessPath),
    false,
    `${relativeFile}: referenced harness escapes packages/lint/test/: ${replacement}`,
  );
  assert.equal(
    fs.existsSync(replacementPath),
    true,
    `${relativeFile}: referenced positive harness does not exist: ${replacement}`,
  );

  const rule = parseSkippedRule(relativeFile, source);
  const manifest = corpusSkipManifest.get(rule);
  assert.ok(
    manifest,
    `${relativeFile}: ${rule} has no mechanically audited corpus-skip manifest entry`,
  );
  assert.equal(
    skip.constraint,
    manifest.constraint,
    `${relativeFile}: corpus constraint does not match the audited ${rule} witness`,
  );
  assert.equal(
    replacement,
    manifest.harness,
    `${relativeFile}: replacement harness does not match the audited ${rule} witness`,
  );
  return rule;
}

function validateCorpusSkipManifestCoverage(cases: readonly string[]): void {
  const used = new Set<string>();
  for (const relativeFile of cases) {
    const source = fs.readFileSync(path.join(casesRoot, relativeFile), "utf8");
    const skip = parseCorpusSkip(relativeFile, source);
    if (skip === null) continue;
    const rule = validateCorpusSkip(relativeFile, source, skip);
    assert.equal(
      used.has(rule),
      false,
      `${relativeFile}: ${rule} already has another corpus-skip fixture`,
    );
    used.add(rule);
  }
  assert.deepEqual(
    [...used].sort(),
    [...corpusSkipManifest.keys()].sort(),
    "corpus-skip manifest entries must correspond exactly to excluded fixtures",
  );
}

function loadCorpusSkipManifest(): Map<string, CorpusSkipManifestEntry> {
  const value: unknown = JSON.parse(
    fs.readFileSync(corpusSkipManifestPath, "utf8"),
  );
  assert.ok(Array.isArray(value), "corpus-skip manifest must be an array");
  const entries = new Map<string, CorpusSkipManifestEntry>();
  for (const [index, item] of value.entries()) {
    assert.ok(
      isRecord(item),
      `corpus-skip manifest entry ${index} must be an object`,
    );
    assert.deepEqual(
      Object.keys(item).sort(),
      ["constraint", "harness", "rule"],
      `corpus-skip manifest entry ${index} has unknown or missing fields`,
    );
    const { rule, constraint, harness } = item;
    assert.ok(
      typeof rule === "string",
      `corpus-skip manifest entry ${index} has an invalid rule`,
    );
    assert.ok(
      isCorpusConstraint(constraint),
      `corpus-skip manifest entry ${index} has an invalid constraint`,
    );
    assert.ok(
      typeof harness === "string",
      `corpus-skip manifest entry ${index} has an invalid harness`,
    );
    assert.equal(
      entries.has(rule),
      false,
      `corpus-skip manifest repeats ${rule}`,
    );
    const harnessPath = path.resolve(repoRoot, harness);
    const relativeHarnessPath = path.relative(harnessRoot, harnessPath);
    assert.equal(
      relativeHarnessPath.startsWith("..") ||
        path.isAbsolute(relativeHarnessPath),
      false,
      `corpus-skip manifest harness escapes packages/lint/test/: ${harness}`,
    );
    assert.equal(
      harness.endsWith("_test.go") && fs.existsSync(harnessPath),
      true,
      `corpus-skip manifest harness is not an existing Go test: ${harness}`,
    );
    entries.set(rule, { rule, constraint, harness });
  }
  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCorpusConstraint(value: unknown): value is CorpusConstraint {
  return (
    typeof value === "string" &&
    corpusConstraintNames.has(value as CorpusConstraint)
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
 * Read the single corpus-skip directive from the source, if any. Its constraint
 * is validated against the manifest before the fixture can be excluded.
 *
 * The directive may appear on any line; it is not required to be the first
 * line. Callers iterate the fixture tree once, so a linear scan is fine.
 */
function parseCorpusSkip(
  relativeFile: string,
  source: string,
): CorpusSkipDirective | null {
  const markerCount = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-skip\b.*$/gm),
  ].length;
  const directives = [
    ...source.matchAll(
      /^\s*\/\/\s*@ttsc-corpus-skip(?:\(([^)]*)\))?\s*:\s*(.*?)\s*$/gm,
    ),
  ].map((match) => ({
    constraint: match[1] ?? null,
    reason: match[2] ?? "",
  }));
  assert.equal(
    directives.length,
    markerCount,
    `${relativeFile}: malformed \`// @ttsc-corpus-skip(<constraint>): <reason>\` directive`,
  );
  assert.ok(
    directives.length <= 1,
    `${relativeFile}: a lint fixture may declare at most one corpus-skip directive`,
  );
  return directives[0] ?? null;
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
 * List every expected or explicitly excluded lint fixture under `casesRoot` as
 * a forward-slash path relative to that root.
 */
function listLintCases(): string[] {
  return walk(casesRoot)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .map((file) => path.relative(casesRoot, file).replaceAll(path.sep, "/"))
    .filter((file) => {
      const source = fs.readFileSync(path.join(casesRoot, file), "utf8");
      return (
        TestLint.parseExpectations(source).length !== 0 ||
        parseCorpusSkip(file, source) !== null
      );
    });
}

function parseSkippedRule(relativeFile: string, source: string): string {
  const expected = new Set(
    TestLint.parseExpectations(source).map((item) => item.rule),
  );
  const declared = [
    ...source.matchAll(
      /^\s*\/\/\s*@ttsc-corpus-rule:\s*([@\w/-]+)\s*$/gm,
    ),
  ].map((match) => match[1] as string);
  assert.ok(
    declared.length <= 1,
    `${relativeFile}: a corpus skip may declare at most one \`// @ttsc-corpus-rule:\` directive`,
  );
  if (declared[0]) expected.add(declared[0]);
  assert.equal(
    expected.size,
    1,
    `${relativeFile}: a corpus skip must identify exactly one rule through an expectation or \`// @ttsc-corpus-rule:\``,
  );
  return [...expected][0] as string;
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
