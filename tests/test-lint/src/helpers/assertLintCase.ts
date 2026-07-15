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

interface CorpusFileRecord {
  relativeFile: string;
  source: string;
  expectations: TestLint.ILintExpectation[];
  skip: CorpusSkipDirective | null;
  companion: boolean;
}

const corpusSkipManifest = loadCorpusSkipManifest();

/**
 * Discover and assert every classified lint fixture under `src/cases`.
 *
 * Classifies every supported TypeScript source in the cases tree as a positive
 * entry, audited skip, or explicit companion, then delegates every entry to
 * `assertLintCase`. Unclassified or conflicting sources fail immediately.
 *
 * A fixture may opt out with one `// @ttsc-corpus-skip(<constraint>): <reason>`
 * directive. Its rule, constraint, and Go harness must match the mechanically
 * audited manifest.
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
  assertLintCases(selected);
}

/**
 * Assert a batch of lint fixtures and report every failure from the sweep.
 *
 * Corpus partitions are expensive real-launcher tests. Continuing after an
 * individual mismatch exposes all stale fixture contracts in one run instead of
 * requiring a full partition restart for each successive failure.
 */
export function assertLintCases(relativeFiles: readonly string[]): void {
  const failures: Error[] = [];
  for (const file of relativeFiles) {
    try {
      assertLintCase(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(new Error(`${file}: ${detail}`, { cause: error }));
    }
  }
  if (failures.length !== 0) {
    throw new AggregateError(
      failures,
      `${failures.length} lint corpus fixture(s) failed`,
    );
  }
}

/**
 * Assert that running the native lint engine on a single fixture file produces
 * exactly the diagnostics declared by its expectation comments.
 *
 * Reads the rule set from the fixture's own annotations so that adding or
 * removing a rule only requires editing the fixture — no other file changes. A
 * rule that needs options carries them in a `// @ttsc-corpus-options: <rule>
 * <json>` directive, which upgrades that rule's config entry to the `[severity,
 * options]` tuple (see `applyCorpusOptions`). Extra sources in the same
 * subdirectory carry `// @ttsc-corpus-companion`; `collectExtraSources`
 * materializes those files at their case-root-relative paths.
 *
 * Honors the audited `// @ttsc-corpus-skip(<constraint>): <reason>` directive:
 * a matching fixture is validated but its flat native run is skipped. The
 * referenced Go harness still has to prove the same rule and constraint through
 * production dispatch.
 *
 * Honors the `// @ttsc-corpus-filename: <path>` directive: the fixture is
 * materialized at the given project-root-relative path (under `src/`) instead
 * of the extension-preserving `src/main<suffix>` default, so path-sensitive
 * rules (filename conventions, directory layouts) can carry their logical
 * filename while the on-disk fixture keeps a corpus-friendly name.
 *
 * @param relativeFile - File path relative to `casesRoot` (forward-slash
 *   separated, e.g. `"consistent-type-imports/violation.ts"`).
 */
export function assertLintCase(relativeFile: string): void {
  const source = fs.readFileSync(path.join(casesRoot, relativeFile), "utf8");
  assert.equal(
    parseCorpusCompanion(relativeFile, source),
    false,
    `${relativeFile}: a corpus companion cannot run as a standalone fixture`,
  );
  const skip = parseCorpusSkip(relativeFile, source);
  if (skip !== null) {
    validateCorpusSkip(relativeFile, source, skip);
    return;
  }
  const expected = TestLint.parseExpectations(source);
  assert.notEqual(
    expected.length,
    0,
    `${relativeFile}: a corpus entry requires an expectation or audited skip`,
  );
  const sourcePath = resolveCorpusSourcePath(source, relativeFile);
  const result = TestLint.run({
    name: relativeFile,
    source,
    sourcePath,
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
  assertLintDiagnostics(
    sourcePath,
    result.diagnostics,
    expected,
    result.stderr,
  );
}

/**
 * Assert exact corpus diagnostics, including their portable fixture-file
 * identity. TestLint rejects case-only source aliases, so case folding here
 * identifies the same target consistently on Windows and POSIX runners.
 */
export function assertLintDiagnostics(
  sourcePath: string,
  diagnostics: readonly TestLint.ILintDiagnostic[],
  expected: readonly TestLint.ILintExpectation[],
  message?: string,
): void {
  const file = portableSourceFileIdentity(sourcePath);
  assert.deepEqual(
    diagnostics.map(({ file: actualFile, rule, severity, line }) => ({
      file: portableSourceFileIdentity(actualFile),
      rule,
      severity,
      line,
    })),
    expected.map(({ rule, severity, line }) => ({
      file,
      rule,
      severity,
      line,
    })),
    message,
  );
}

/** Normalize a rendered source path to the fixture's portable identity. */
function portableSourceFileIdentity(sourcePath: string): string {
  return path.posix.normalize(sourcePath.replaceAll("\\", "/")).toLowerCase();
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

export function validateCorpusSkipManifestCoverage(
  cases: readonly string[],
): void {
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
 * parsed from the fixture's expectation annotations. Each directive turns the
 * named rule's severity into the `[severity, options]` tuple the lint config
 * format accepts, so option-bearing rules (e.g. `unicorn/string-content`, which
 * reports nothing without configured patterns) can run through the same flat
 * corpus as default-configured ones.
 *
 * A directive naming a rule without any expectation is a fixture bug: the
 * options would silently configure nothing, so it fails loudly. The Go rule
 * corpus helper (`newRuleCorpusEngine`) parses the identical directive.
 */
export function applyCorpusOptions(
  relativeFile: string,
  source: string,
  rules: Record<string, TestLint.LintRuleConfigEntry>,
): Record<string, TestLint.LintRuleConfigEntry> {
  const markerCount = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-options(?=\s|:|$).*$/gm),
  ].length;
  const directives = [
    ...source.matchAll(
      /^\s*\/\/\s*@ttsc-corpus-options\s*:\s*(\S+)\s+(\S.*?)\s*$/gm,
    ),
  ];
  assert.equal(
    directives.length,
    markerCount,
    `${relativeFile}: malformed \`// @ttsc-corpus-options: <rule> <json>\` directive`,
  );
  for (const match of directives) {
    const [, rule, payload] = match;
    if (!rule || !payload) continue;
    const severity = rules[rule];
    assert.notEqual(
      severity,
      undefined,
      `${relativeFile}: @ttsc-corpus-options names ${rule}, which has no expectation annotation`,
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
 * Resolve the project-root-relative path at which a corpus fixture is
 * materialized. An explicit `// @ttsc-corpus-filename: <path>` directive wins;
 * otherwise the fixture's TypeScript extension is preserved under `src/` so TSX
 * is parsed as TSX. Path validation (must stay under `src/`) is owned by
 * `TestLint`.
 */
export function resolveCorpusSourcePath(
  source: string,
  relativeFile: string,
): string {
  const markerCount = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-filename(?=\s|:|$).*$/gm),
  ].length;
  const directives = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-filename\s*:\s*(.*?)\s*$/gm),
  ];
  assert.equal(
    directives.length,
    markerCount,
    `${relativeFile}: malformed \`// @ttsc-corpus-filename: <path>\` directive`,
  );
  assert.ok(
    directives.length <= 1,
    `${relativeFile}: a lint fixture may declare at most one corpus-filename directive`,
  );
  if (directives[0]) {
    const sourcePath = directives[0][1] ?? "";
    assert.notEqual(
      sourcePath.length,
      0,
      `${relativeFile}: \`// @ttsc-corpus-filename:\` requires a path`,
    );
    return sourcePath;
  }
  if (TestLint.hasNonCanonicalTypeScriptSourceExtension(relativeFile)) {
    throw new Error(
      `${relativeFile}: TypeScript source extension must use canonical lowercase spelling`,
    );
  }
  const extension = TestLint.typescriptSourceExtension(relativeFile);
  assert.notEqual(
    extension,
    null,
    `${relativeFile}: unsupported TypeScript source extension`,
  );
  return path.posix.join("src", `main${extension}`);
}

/**
 * List every lint entry under a corpus root as a forward-slash relative path.
 *
 * Discovery starts from every TypeScript source instead of treating the
 * presence of an expectation as an implicit entry marker. Each source must be a
 * positive entry, an audited skip, or an explicit companion; an unclassified
 * source fails loudly so a typo cannot silently remove coverage.
 */
export function listLintCases(root: string = casesRoot): string[] {
  const records = walk(root)
    .filter((file) => {
      if (TestLint.hasNonCanonicalTypeScriptSourceExtension(file)) {
        const relativeFile = path
          .relative(root, file)
          .replaceAll(path.sep, "/");
        throw new Error(
          `${relativeFile}: TypeScript source extension must use canonical lowercase spelling`,
        );
      }
      return TestLint.isTypeScriptSourcePath(file);
    })
    .map((file): CorpusFileRecord => {
      const relativeFile = path.relative(root, file).replaceAll(path.sep, "/");
      const source = fs.readFileSync(file, "utf8");
      return {
        relativeFile,
        source,
        expectations: TestLint.parseExpectations(source),
        skip: parseCorpusSkip(relativeFile, source),
        companion: parseCorpusCompanion(relativeFile, source),
      };
    });

  for (const record of records) {
    if (record.companion) {
      validateCorpusCompanionRole(record);
      continue;
    }
    assert.ok(
      record.expectations.length !== 0 || record.skip !== null,
      `${record.relativeFile}: a corpus source must declare an expectation, audited skip, or @ttsc-corpus-companion`,
    );
  }
  validateCorpusCompanionCoverage(records);
  return records
    .filter((record) => !record.companion)
    .map((record) => record.relativeFile);
}

/** Read and validate the single explicit companion marker, if present. */
function parseCorpusCompanion(relativeFile: string, source: string): boolean {
  const markerCount = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-companion\b.*$/gm),
  ].length;
  const directives = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-companion\s*$/gm),
  ];
  assert.equal(
    directives.length,
    markerCount,
    `${relativeFile}: malformed \`// @ttsc-corpus-companion\` directive`,
  );
  assert.ok(
    directives.length <= 1,
    `${relativeFile}: a corpus source may declare at most one companion directive`,
  );
  return directives.length === 1;
}

function validateCorpusCompanionRole(record: CorpusFileRecord): void {
  assert.equal(
    record.expectations.length,
    0,
    `${record.relativeFile}: a corpus companion cannot declare expectations`,
  );
  assert.equal(
    record.skip,
    null,
    `${record.relativeFile}: a corpus companion cannot also be an audited skip`,
  );
  assert.equal(
    /^\s*\/\/\s*@ttsc-corpus-(?:filename|options|rule)\b/m.test(record.source),
    false,
    `${record.relativeFile}: a corpus companion cannot declare entry directives`,
  );
}

function validateCorpusCompanionCoverage(
  records: readonly CorpusFileRecord[],
): void {
  const entries = records.filter(
    (record) =>
      !record.companion &&
      record.skip === null &&
      record.expectations.length !== 0,
  );
  for (const companion of records.filter((record) => record.companion)) {
    const owners = entries.filter((entry) => {
      const caseDirectory = path.posix.dirname(entry.relativeFile);
      return (
        caseDirectory !== "." &&
        companion.relativeFile.startsWith(`${caseDirectory}/src/`)
      );
    });
    assert.equal(
      owners.length,
      1,
      `${companion.relativeFile}: a corpus companion must belong to exactly one positive entry whose case directory contains it under src/`,
    );
  }
}

function parseSkippedRule(relativeFile: string, source: string): string {
  const expected = new Set(
    TestLint.parseExpectations(source).map((item) => item.rule),
  );
  const declared = [
    ...source.matchAll(/^\s*\/\/\s*@ttsc-corpus-rule:\s*([@\w/-]+)\s*$/gm),
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
 * Gather explicitly marked companion files from the same grouped case as
 * `relativeFile`. The companion tree mirrors project-root-relative paths, so a
 * case's `src/types-fixture.ts` is materialized once at that exact path.
 *
 * Returns an empty object when the fixture sits directly under `casesRoot`
 * (i.e. no subdirectory companion files are expected).
 *
 * @param relativeFile - File path relative to `root`.
 * @param root - Corpus root containing the grouped case.
 */
export function collectExtraSources(
  relativeFile: string,
  root: string = casesRoot,
): Record<string, string> {
  const dir = path.posix.dirname(relativeFile);
  if (dir === ".") return {};
  const caseRoot = path.join(root, dir);
  const out: Record<string, string> = {};
  for (const file of walk(caseRoot)) {
    const rel = path.relative(caseRoot, file).replaceAll(path.sep, "/");
    if (!rel.startsWith("src/")) continue;
    if (!TestLint.isTypeScriptSourcePath(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const companionFile = path.posix.join(dir, rel);
    if (!parseCorpusCompanion(companionFile, source)) continue;
    out[rel] = source;
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
