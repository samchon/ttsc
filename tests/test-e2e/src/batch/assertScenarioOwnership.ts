import fs from "node:fs";
import path from "node:path";

/**
 * Fail when a scenario file under `features` is imported by no other module of
 * the suite, so no CI job would execute it.
 *
 * WARNING (#1731): #1603 moved 185 scenarios into this package without a batch
 * that ran them, and nothing noticed for days, because CI only executes the
 * batches `src/main.ts` names. A scenario is any `test_*.ts` below `features`
 * other than a batch file; it is owned when a non-scenario module of `src`
 * imports it, directly from a batch or through a support module a batch runs.
 * Never replace this check with a hand-kept list of expected scenarios.
 *
 * @param source The suite's `src` directory.
 * @throws When any scenario file is unowned, naming every one.
 * @evidence contracts/common.md#principled-implementation Ownership is read from the actual import statements of the suite's modules, the same edges the runner follows, rather than from a list of names.
 * @evidence contracts/common.md#clear-and-simple-design One pass collects import targets and one pass compares the scenario files against them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No scenario is exempted by name; a deliberately dormant scenario must be deleted or imported.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs state the regression, what counts as a scenario and an owner, and the rule against lists.
 * @evidence contracts/portability.md#os-neutral-implementation Import specifiers are resolved with Node path APIs against each importing file's directory.
 * @evidence contracts/performance.md#efficient-algorithms Each source file is read once and its imports matched once; membership checks use a set.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The check runs once per suite launch and keeps nothing.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Only path strings are retained until the function returns; synchronous reads hold no descriptor.
 */
export function assertScenarioOwnership(source: string): void {
  const features = path.join(source, "features");
  const files = listTypeScript(source);
  const scenarios = files.filter(
    (file) =>
      isWithin(features, file) &&
      /^test_\w+\.ts$/.test(path.basename(file)) &&
      !/^test_e2e_\w+_batch\.ts$/.test(path.basename(file)),
  );
  const scenarioSet = new Set(scenarios);
  const owned = new Set<string>();
  for (const file of files) {
    if (scenarioSet.has(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = path.resolve(path.dirname(file), match[1]!);
      owned.add(target.endsWith(".ts") ? target : `${target}.ts`);
    }
  }
  const unowned = scenarios.filter((file) => !owned.has(file));
  if (unowned.length !== 0)
    throw new Error(
      [
        `${unowned.length} E2E scenario file(s) are imported by no batch or support module, so CI never runs them (#1731):`,
        ...unowned.map((file) => `  ${path.relative(source, file)}`),
      ].join("\n"),
    );
}

function listTypeScript(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScript(location);
    return entry.isFile() && entry.name.endsWith(".ts") ? [location] : [];
  });
}

function isWithin(parent: string, file: string): boolean {
  const relative = path.relative(parent, file);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}
