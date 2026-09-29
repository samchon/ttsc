import fs from "node:fs";

import { materializeLintCorpus } from "../../tests/test-lint/src/helpers/assertLintCase.ts";

const [directory, manifest] = process.argv.slice(2);
if (!directory || !manifest)
  throw new Error("expected corpus directory and manifest path");
const cases = materializeLintCorpus(directory);
if (cases.length === 0)
  throw new Error("lint corpus has no executable fixtures");
fs.writeFileSync(manifest, JSON.stringify(cases));
console.log(`Prepared ${cases.length} lint fixtures for one Go test process`);
