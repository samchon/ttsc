#!/usr/bin/env node
// Run every classified lint fixture under `src/cases` and print a final
// pass/failure summary. It shares the strict discovery contract used by the
// partitioned e2e runner.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(here, "..");
process.chdir(pkgRoot);

// Use the same strict discovery contract as the partitioned corpus runner.
const { assertLintCase, listLintCases, validateCorpusSkipManifestCoverage } =
  await import(
    pathToFileURL(path.join(pkgRoot, "src", "helpers", "assertLintCase.ts"))
  );

const cases = listLintCases();
validateCorpusSkipManifestCoverage(cases);

let pass = 0;
const failures = [];
for (const file of cases) {
  try {
    assertLintCase(file);
    pass += 1;
  } catch (err) {
    failures.push({ file, message: err?.message || String(err) });
  }
}
console.log(`PASS ${pass} / FAIL ${failures.length} / TOTAL ${cases.length}`);
for (const f of failures) {
  console.log(`--- ${f.file} ---`);
  console.log(f.message.split("\n").slice(0, 12).join("\n"));
  console.log("");
}
process.exit(failures.length > 0 ? 1 : 0);
