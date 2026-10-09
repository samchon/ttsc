import fs from "node:fs";
import { inspect } from "node:util";

// This one actor borrows an already prepared graph. Natural Node termination
// drains queued public Rollup work; only its parent may restore shared inputs.
const [routine, requestFile, resultFile] = process.argv.slice(2);
let result;
try {
  const { viteBuildCorpus } = await import(routine);
  await viteBuildCorpus(JSON.parse(fs.readFileSync(requestFile, "utf8")));
  result = { ok: true };
} catch (error) {
  result = { ok: false, failure: inspect(error, { depth: null, customInspect: false, getters: false }) };
}
fs.writeFileSync(resultFile, JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
