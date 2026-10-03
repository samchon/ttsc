import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../../utils/src/TestProject";
import { captureE2eTracePhase, type TracePhaseObservation } from "../../../internal/captureE2eTracePhase";
import type { PreparedAssetSelection } from "../../../internal/captureE2ePreparedAssets";
import { readE2eTraceMeasurements } from "../../../internal/readE2eTraceMeasurements";
import { readE2eTracePayload } from "../../../internal/readE2eTracePayload";
import { case_evidence_bridge_preserves_observed_json_transport } from "./case_evidence_bridge_preserves_observed_json_transport";

/**
 * Connects the original scaffold and first model to real cold native checks.
 * Caller supplies two fresh writable slots under the shared installed consumer,
 * including their prisma/schema directories, and the prepared lint/Evidence
 * binary and immutable producer assets. This profile does not install or build.
 *
 * 1. Write the exact original schema at its original relative address.
 * 2. Capture the real check callback between explicit asset/cache observations.
 * 3. Pair raw schema admission with independent native success/failure literals.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual supported native check evaluates the installed Evidence contributor. The model-free raw document and target model document must independently accompany status0 and status2 with the missing-prisma-docs diagnostic, respectively.
 * @evidence contracts/testing.md#independent-expectations Two-generator SQLite scaffold bytes, model target/id bytes, original main.prisma/model.prisma paths, raw schema ID and target name are authored literals. Neither observed digests nor native output generates these expectations.
 * @evidence contracts/testing.md#distinguishing-cases Fresh separate native processes force process-owned parser cache coldness. Each requires an actual native lookup miss, real Node Run, raw JSON capture and unmarshal; no cached DTO or empty trace can substitute. Empty models and the first selected model have opposite whole-command verdicts.
 * @evidence contracts/testing.md#execution-ownership Callable body is authored but not registered or executed. Supplied slots must belong to the common consumer; caller binds the actual binary/loader/SDK manifest, required writer population and joined cleanup. Existing direct T/G units retain parser fields and activation policy.
 * @evidence contracts/e2e.md#necessary-boundary Built loader admission and Node-to-Go JSON may disagree with direct parser/policy units. The real native failure verdict adds the downstream graph-rule consequence without adding a product field or API.
 * @evidence contracts/e2e.md#shared-execution Two cold inputs share the supplied producer, installation and trace root. Their two actual native processes and Programs are distinct and measured, not claimed as one reused Program. No fixture preparation or benchmark is executed by authoring this body.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Writes only absent controlled files with wx and does not remove or overwrite existing inputs. Fixed schema observations bracket the actual synchronous command. Caller retains slots and trace captures until actual writer/descendant ownership is settled; direct-child return alone is not arbitrary descendant proof.
 * @evidence contracts/e2e.md#preserved-coverage Preserves original cold zero-model and first-model transport and the missing-reference whole-host contrast. TS const/function and Markdown H1/H2 activation contrasts remain separate pending host profiles; this body does not certify their survival or authorize donor deletion.
 */
export async function case_evidence_cold_prisma_population_controls_native_failure(input: {
  traceRoot: string;
  binary: string;
  scaffoldRoot: string;
  modelRoot: string;
  producerAssets: readonly PreparedAssetSelection[];
  cacheRoots: readonly string[];
}): Promise<readonly TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>[]> {
  assert.ok(path.isAbsolute(input.binary));
  assert.notEqual(fs.realpathSync.native(input.scaffoldRoot), fs.realpathSync.native(input.modelRoot));
  assert.ok(input.producerAssets.some(asset => asset.role === "executable" &&
    fs.realpathSync.native(asset.file) === fs.realpathSync.native(input.binary)), "selected native executable asset");
  const fixture = path.join(TestProject.WORKSPACE_ROOT, "tests/test-e2e/fixtures/evidence/prisma-cold-admission");
  const phases: TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>[] = [];
  const failures: unknown[] = [];
  let cursor = readE2eTraceMeasurements(input.traceRoot, []).lastWriterSequences;
  for (const row of [
    { name: "scaffold", root: input.scaffoldRoot, source: "prisma/schema/main.prisma", fixture: "scaffold.prisma", status: 0 },
    { name: "first-model", root: input.modelRoot, source: "prisma/schema/model.prisma", fixture: "model.prisma", status: 2 },
  ]) {
    try {
      assert.ok(path.isAbsolute(row.root));
      assert.equal(fs.lstatSync(path.join(row.root, "missing-prisma-docs"), { throwIfNoEntry: false }), undefined,
        "original missing reference root remains absent");
      for (const name of ["prisma/schema/main.prisma", "prisma/schema/model.prisma", "cold-main.ts", "cold-tsconfig.json", "cold-evidence.config.ts"])
        assert.equal(fs.lstatSync(path.join(row.root, name), { throwIfNoEntry: false }), undefined, `fresh controlled slot ${name}`);
      fs.writeFileSync(path.join(row.root, row.source), fs.readFileSync(path.join(fixture, row.fixture)), { flag: "wx" });
      fs.writeFileSync(path.join(row.root, "cold-main.ts"), "export {};\n", { flag: "wx" });
      fs.writeFileSync(path.join(row.root, "cold-tsconfig.json"), '{"compilerOptions":{"strict":true},"files":["cold-main.ts"]}\n', { flag: "wx" });
      fs.writeFileSync(path.join(row.root, "cold-evidence.config.ts"),
        'import { evidence } from "@ttsc/evidence";\nexport default { plugins: { evidence }, rules: { "evidence/graph": ["error", ' +
        JSON.stringify({ claims: [{ type: "prisma", files: [row.source], symbol: "model",
          reference: { type: "markdown", root: "missing-prisma-docs", files: ["**/*.md"], symbol: "h2" } }] }) + ' ] } };\n',
        { flag: "wx" });
      const fixedLabel = `cold-prisma-${row.name}`;
      const requiredWriterPids: number[] = [];
      const phase = await captureE2eTracePhase({
        label: fixedLabel, traceRoot: input.traceRoot, cacheRoots: input.cacheRoots,
        requiredWriterPids, afterSequences: cursor,
        assets: [...input.producerAssets,
          { label: fixedLabel, file: path.join(row.root, row.source), role: "fixture" },
          { label: `${fixedLabel}-config`, file: path.join(row.root, "cold-evidence.config.ts"), role: "configuration" },
          { label: `${fixedLabel}-tsconfig`, file: path.join(row.root, "cold-tsconfig.json"), role: "configuration" },
          { label: `${fixedLabel}-source`, file: path.join(row.root, "cold-main.ts"), role: "fixture" }],
      }, async () => {
        const result = E2eProcessTrace.spawnSync(input.binary, ["check", "--cwd", row.root,
          "--tsconfig", "cold-tsconfig.json", "--plugins-json",
          JSON.stringify([{ name: "@ttsc/lint", config: { configFile: "cold-evidence.config.ts" } }])],
          { cwd: row.root, env: process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        if (Number.isSafeInteger(result.pid) && result.pid > 0) requiredWriterPids.push(result.pid);
        return result;
      });
      phases.push(phase);
      if (phase.traces) cursor = phase.traces.lastWriterSequences;
      assert.deepEqual(phase.observationErrors, []);
      assert.equal(phase.outcome.returned, true);
      if (!phase.outcome.returned) throw phase.outcome.error;
      const result = phase.outcome.value;
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.ok(Number.isSafeInteger(result.pid) && result.pid > 0);
      assert.equal(result.status, row.status, String(result.stderr));
      assert.equal(result.stdout, "");
      if (row.status === 2) {
        assert.ok(String(result.stderr).includes("evidence/graph"));
        assert.ok(String(result.stderr).includes("missing-prisma-docs"));
      }
      assert.ok(phase.traces && phase.assetsAfter);
      case_evidence_bridge_preserves_observed_json_transport(input.traceRoot, phase.traces, {
        writerPid: result.pid, bridge: "prisma", root: row.root,
        lookupSources: [row.source], requestSources: [row.source], documentIds: ["schema"], problemIds: [],
        digests: [{ id: "schema", native: "present", wire: "nonempty" }], fixedAssetLabels: [fixedLabel],
      }, phase.assetsBefore, phase.assetsAfter);
      const replies = phase.traces.writerObservations.filter(({ observation }) => observation.writerPid === result.pid &&
        observation.event === "bridge-result" && observation.data?.bridge === "prisma" && observation.data.nativeLookup === true);
      assert.equal(replies.length, 1);
      const reply = replies[0]!.observation;
      const payload = readE2eTracePayload(input.traceRoot, reply, reply.data?.stdout);
      const wire = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload.bytes));
      assert.deepEqual(wire.documents.map((document: { id: string }) => document.id), ["schema"]);
      assert.deepEqual(wire.problems, []);
      assert.deepEqual(wire.documents[0].models.map((model: { name: string }) => model.name),
        row.status === 0 ? [] : ["target"]);
      assert.equal(fs.lstatSync(path.join(row.root, "missing-prisma-docs"), { throwIfNoEntry: false }), undefined);
    } catch (error) { failures.push(new Error(`cold Prisma ${row.name}`, { cause: error })); }
  }
  if (failures.length) throw new AggregateError(failures, "Cold Prisma admission and native failure");
  return phases;
}
