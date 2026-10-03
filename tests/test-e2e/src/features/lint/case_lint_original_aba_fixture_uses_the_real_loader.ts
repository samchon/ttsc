import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { requireE2eBaselinePreparation } from "../../internal/requireE2eBaselinePreparation";
import type { TracePhaseObservation } from "../../internal/captureE2eTracePhase";
import { case_lint_loader_preserves_aba_instability_after_restoration } from "./case_lint_loader_preserves_aba_instability_after_restoration";

/**
 * Places the original ABA hook/config bytes in one fresh owned consumer slot.
 * Template substitution supplies only the native dependency address originally
 * quoted by the Go fixture; hook body and before/during module text stay literal.
 * A minimal TS file/tsconfig admits the supported native check command, without
 * adding another semantic scenario or production API.
 *
 * @evidence contracts/testing.md#behavioral-verification The prepared original CJS hook executes through a real native check, reads selection.cjs during its official load and restores before/rule bytes. Delegated observer requires actual during/rule off raw value, false/empty raw/native fingerprint and uncached retry outcome.
 * @evidence contracts/testing.md#independent-expectations Exact before/rule and during/rule modules, helper/config names, official registerHooks body and factory export come from the previously unmapped fixture-byte slice at donor lines365–384. Native address substitution is the original fixture's quoted-path parameter, not a generated expected reply.
 * @evidence contracts/testing.md#distinguishing-cases Before-byte restoration cannot hide during selection or a reusable fingerprint. Absent controlled slots and actual baseline/current producer identity admission exclude overwriting a warmed config. Explicit off rule names remain off and are not replaced by a different registered rule.
 * @evidence contracts/testing.md#execution-ownership Authored callable and exact fixture files are unregistered/unexecuted. Caller owns the genuine completed baseline, original fresh slot under prepared consumer, binary/SDK/Node selection, required writer binding and joined scratch cleanup.
 * @evidence contracts/e2e.md#necessary-boundary Uses the original real official Node hook plus result-file/native-normalization consumer. Existing injected evaluator/directory policy units cannot establish this actual transport; no fake host or new product output is introduced.
 * @evidence contracts/e2e.md#shared-execution Same supplied binary/installation/cache/trace is retained; one native command and its existing three bounded real loader retries are measured separately. This wrapper builds/installs nothing and does not create an additional preparation family.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Writes only absent owned files with wx after same-root baseline admission. Literal config hook owns temporary helper writes/finally restore. Wrapper never removes inputs or rewrites them after an uncertain command; caller retains them until actual writer/descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage Connects original before/during factory and real helper address to the authored raw/refusal/restoration observer. Only the missing exact fixture slice was read for this body, no original verdict repeated. Donor remains pending actual registered survival; broader config graph/parity/resident profiles remain separate.
 */
export async function case_lint_original_aba_fixture_uses_the_real_loader(input:
  Omit<Parameters<typeof case_lint_loader_preserves_aba_instability_after_restoration>[0],
    "tsconfig" | "configFile" | "helperFile" | "beforeBytes" | "duringValue" | "rawHelperPath" | "normalizedHelperPath"> & {
    baseline: TracePhaseObservation<unknown>;
    baselineProducerLabels: Readonly<Record<string, string>>;
  },
): ReturnType<typeof case_lint_loader_preserves_aba_instability_after_restoration> {
  requireE2eBaselinePreparation(input.baseline, input.traceRoot, input.producerAssets, input.baselineProducerLabels);
  const directory = fs.realpathSync.native(input.directory);
  const helperFile = path.join(directory, "selection.cjs");
  for (const name of ["selection.cjs", "lint.config.cjs", "aba-main.ts", "aba-tsconfig.json"])
    assert.equal(fs.lstatSync(path.join(directory, name), { throwIfNoEntry: false }), undefined, `fresh ABA slot ${name}`);
  const fixture = path.join(TestProject.WORKSPACE_ROOT, "tests/test-e2e/fixtures/lint/aba-loader");
  const beforeBytes = fs.readFileSync(path.join(fixture, "selection.cjs"));
  assert.equal(beforeBytes.toString("utf8"), 'module.exports = { rules: { "before/rule": "off" } };\n');
  const template = fs.readFileSync(path.join(fixture, "lint.config.cjs.in"), "utf8");
  assert.equal(template.split("__TTSC_ABA_DEPENDENCY__").length, 2);
  assert.ok(template.endsWith("module.exports = () => require(dependency);\n"));
  fs.writeFileSync(helperFile, beforeBytes, { flag: "wx" });
  // The original Go raw config literal ends at the final semicolon, unlike
  // the source-controlled template's terminal LF.
  fs.writeFileSync(path.join(directory, "lint.config.cjs"), template.replace("__TTSC_ABA_DEPENDENCY__", JSON.stringify(helperFile)).slice(0, -1), { flag: "wx" });
  fs.writeFileSync(path.join(directory, "aba-main.ts"), "export {};\n", { flag: "wx" });
  fs.writeFileSync(path.join(directory, "aba-tsconfig.json"), '{"compilerOptions":{"strict":true},"files":["aba-main.ts"]}\n', { flag: "wx" });
  return await case_lint_loader_preserves_aba_instability_after_restoration({ ...input, directory,
    tsconfig: "aba-tsconfig.json", configFile: "lint.config.cjs", helperFile, beforeBytes,
    duringValue: { rules: { "during/rule": "off" } }, rawHelperPath: helperFile, normalizedHelperPath: helperFile });
}
