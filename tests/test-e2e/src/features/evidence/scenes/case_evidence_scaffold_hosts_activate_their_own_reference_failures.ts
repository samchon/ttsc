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
 * Connects the scaffold donor's three host contrasts to real native checks.
 * Caller supplies fresh three-profile slots under one installed consumer and
 * the same prepared binary/loader assets. The original Prisma scaffold remains
 * model-free while the original TS function or Markdown H2 activates its own
 * missing reference. No direct-policy result is used as a native reply.
 *
 * @evidence contracts/testing.md#behavioral-verification Three real check callbacks retain original const/H1 inactive, function active and H2 active inputs under the original three claims. Exact status0/2 and each independently named missing reference root observe whole-host failure while actual raw schema models[] proves cold scaffold admission.
 * @evidence contracts/testing.md#independent-expectations Source/document text, root names, three claim selectors and opposite native verdicts are the original literal matrix preserved by TestPrismaDecodedActivationPreservesReferenceFailures. Actual raw response, trace counters and diagnostics do not derive expected values.
 * @evidence contracts/testing.md#distinguishing-cases The same model-free scaffold accompanies all three rows; only the function or H2 changes. Each selected missing reference root must appear with evidence/graph on status2, and an actual lookup miss/Node Run/schema response is required in every phase.
 * @evidence contracts/testing.md#execution-ownership Callable scene is authored but unregistered and unexecuted. Caller owns prepared installation, binary/SDK/loader binding, named writer manifest and later cleanup; direct native policy units remain distinct from actual CLI transport survival.
 * @evidence contracts/e2e.md#necessary-boundary Installed loader, cold Prisma admission, native Program declarations/Markdown scan and whole-command failure transport are assembled in the actual product. Authored decoded inventories and direct activation policy cannot certify that connection.
 * @evidence contracts/e2e.md#shared-execution Reuses one supplied producer/installation and fixed opt-in trace root. Three fresh native processes and Programs are intentionally distinct cold populations and separately measured; no repeated source build or installation is performed here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Requires distinct caller-owned slots and absent controlled files/reference directories, writes wx only, and leaves all inputs/captures to caller-owned joined cleanup. Callback return observes the direct synchronous command, not arbitrary descendant termination; no uncertain inputs are rewritten or removed.
 * @evidence contracts/e2e.md#preserved-coverage Retains original three-inactive-hosts/function-activates-reference/heading-activates-reference names and exact TS/Markdown/scaffold/config inputs, cold admission and native failure literals. First target model has a separate callable connection; original donors remain until actual registered survivor execution and coverage.
 */
export async function case_evidence_scaffold_hosts_activate_their_own_reference_failures(input: {
  traceRoot: string;
  binary: string;
  roots: readonly [string, string, string];
  producerAssets: readonly PreparedAssetSelection[];
  cacheRoots: readonly string[];
}): Promise<readonly TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>[]> {
  assert.ok(path.isAbsolute(input.binary));
  assert.equal(new Set(input.roots.map(root => fs.realpathSync.native(root))).size, 3);
  assert.ok(input.producerAssets.some(asset => asset.role === "executable" &&
    fs.realpathSync.native(asset.file) === fs.realpathSync.native(input.binary)));
  const claims = [
    { type: "typescript", files: ["src/**/*.ts"], symbol: "function",
      reference: { type: "markdown", root: "missing-typescript-docs", files: ["**/*.md"], symbol: "h2" } },
    { type: "markdown", files: ["docs/claim.md"], symbol: "h2",
      reference: { type: "prisma", root: "missing-markdown-prisma", files: ["**/*.prisma"], symbol: "model" } },
    { type: "prisma", files: ["prisma/schema/main.prisma"], symbol: "model",
      reference: { type: "markdown", root: "missing-prisma-docs", files: ["**/*.md"], symbol: "h2" } },
  ];
  const scaffold = fs.readFileSync(path.join(TestProject.WORKSPACE_ROOT,
    "tests/test-e2e/fixtures/evidence/prisma-cold-admission/scaffold.prisma"));
  const phases: TracePhaseObservation<ReturnType<typeof E2eProcessTrace.spawnSync>>[] = [];
  const failures: unknown[] = [];
  let cursor = readE2eTraceMeasurements(input.traceRoot, []).lastWriterSequences;
  const rows = [
    { name: "three-inactive-hosts", source: "export const value = 1;\n", document: "# Claim\n", missingRoot: "" },
    { name: "function-activates-reference", source: "export const value = 1;\nexport function selected(): void {}\n", document: "# Claim\n", missingRoot: "missing-typescript-docs" },
    { name: "heading-activates-reference", source: "export const value = 1;\n", document: "# Claim\n## Selected\n", missingRoot: "missing-markdown-prisma" },
  ];
  for (const [index, row] of rows.entries()) {
    const root = input.roots[index]!;
    try {
      assert.ok(path.isAbsolute(root));
      for (const claim of claims)
        assert.equal(fs.lstatSync(path.join(root, claim.reference.root), { throwIfNoEntry: false }), undefined);
      const files = ["src/claim.ts", "docs/claim.md", "prisma/schema/main.prisma", "host-tsconfig.json", "host-evidence.config.ts"];
      for (const name of files)
        assert.equal(fs.lstatSync(path.join(root, name), { throwIfNoEntry: false }), undefined, `fresh controlled slot ${name}`);
      fs.writeFileSync(path.join(root, files[0]!), row.source, { flag: "wx" });
      fs.writeFileSync(path.join(root, files[1]!), row.document, { flag: "wx" });
      fs.writeFileSync(path.join(root, files[2]!), scaffold, { flag: "wx" });
      fs.writeFileSync(path.join(root, files[3]!), '{"compilerOptions":{"strict":true},"files":["src/claim.ts"]}\n', { flag: "wx" });
      fs.writeFileSync(path.join(root, files[4]!), 'import { evidence } from "@ttsc/evidence";\n' +
        'export default { plugins: { evidence }, rules: { "evidence/graph": ["error", ' + JSON.stringify({ claims }) + '] } };\n',
        { flag: "wx" });
      const fixedLabel = `scaffold-host-${row.name}`;
      const requiredWriterPids: number[] = [];
      const phase = await captureE2eTracePhase({ label: fixedLabel, traceRoot: input.traceRoot,
        cacheRoots: input.cacheRoots, afterSequences: cursor, requiredWriterPids,
        assets: [...input.producerAssets, ...files.map((file, slot) => ({
          label: slot === 2 ? fixedLabel : `${fixedLabel}-${slot}`, file: path.join(root, file),
          role: slot >= 3 ? "configuration" as const : "fixture" as const,
        }))],
      }, async () => {
        const result = E2eProcessTrace.spawnSync(input.binary, ["check", "--cwd", root,
          "--tsconfig", "host-tsconfig.json", "--plugins-json",
          JSON.stringify([{ name: "@ttsc/lint", config: { configFile: "host-evidence.config.ts" } }])],
          { cwd: root, env: process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
      assert.equal(result.status, row.missingRoot === "" ? 0 : 2, String(result.stderr));
      assert.equal(result.stdout, "");
      if (row.missingRoot !== "") {
        assert.ok(String(result.stderr).includes("evidence/graph"));
        assert.ok(String(result.stderr).includes(row.missingRoot));
      }
      assert.ok(phase.traces && phase.assetsAfter);
      case_evidence_bridge_preserves_observed_json_transport(input.traceRoot, phase.traces, {
        writerPid: result.pid, bridge: "prisma", root, lookupSources: ["prisma/schema/main.prisma"],
        requestSources: ["prisma/schema/main.prisma"], documentIds: ["schema"], problemIds: [],
        digests: [{ id: "schema", native: "present", wire: "nonempty" }], fixedAssetLabels: [fixedLabel],
      }, phase.assetsBefore, phase.assetsAfter);
      const replies = phase.traces.writerObservations.filter(({ observation }) => observation.writerPid === result.pid &&
        observation.event === "bridge-result" && observation.data?.bridge === "prisma" && observation.data.nativeLookup === true);
      assert.equal(replies.length, 1);
      const reply = replies[0]!.observation;
      const wire = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
        readE2eTracePayload(input.traceRoot, reply, reply.data?.stdout).bytes));
      assert.deepEqual(wire.documents.map((document: { id: string }) => document.id), ["schema"]);
      assert.deepEqual(wire.documents[0].models, []);
      assert.deepEqual(wire.problems, []);
      for (const claim of claims)
        assert.equal(fs.lstatSync(path.join(root, claim.reference.root), { throwIfNoEntry: false }), undefined);
    } catch (error) { failures.push(new Error(row.name, { cause: error })); }
  }
  if (failures.length) throw new AggregateError(failures, "Scaffold host activation transport");
  return phases;
}
