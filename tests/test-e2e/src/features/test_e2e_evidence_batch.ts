import { TestProject } from "@ttsc/testing";
import { createRequire } from "node:module";
import path from "node:path";

import { CompilerTarget } from "../../../../packages/ttsc/lib/plugin/internal/source/CompilerTarget.js";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { case_evidence_backend_claims_activate_after_generation } from "./evidence/scenes/case_evidence_backend_claims_activate_after_generation";

/**
 * Verifies the backend graph's real generated-workspace activation boundary.
 *
 * This entry restores one deleted ordinary benchmark feature test. The legacy
 * Evidence consumer wrapper, `test_e2e_evidence`, runs in the scenarios batch.
 *
 * The scenario builds the evidence benchmark with typia's transform, whose
 * native code compiles against the TypeScript 7.0 compiler target only. On a
 * workspace that installs another line, such as the TypeScript 7.1 E2E lane,
 * the entry reports a named skip until typia ships native code that compiles on
 * both targets (samchon/ttsc#1804).
 *
 * 1. Skip, naming the reason, when the workspace TypeScript is not on 7.0.
 * 2. Prepare the actual generated todo workspace once through its owning API.
 * 3. Collect disabled controls and every staged claim's activation verdict.
 *
 * @evidence contracts/testing.md#behavioral-verification The scenario judges actual generation and compiler gates, named obligations and generated package-accessor coverage; this entry only supplies discovery.
 * @evidence contracts/testing.md#independent-expectations The scenario owns independently derived instruction, heading and generated-accessor expectations.
 * @evidence contracts/testing.md#distinguishing-cases Disabled owner success, all enabled claim populations and installed package accessor completeness remain distinct scenario assertions.
 * @evidence contracts/testing.md#execution-ownership src/index.ts explicitly selects this batch, which awaits the backend scenario; the legacy Evidence consumer cases are called by test_e2e_evidence in the scenarios batch.
 * @evidence contracts/e2e.md#necessary-boundary The scenario crosses actual materialization, pnpm workspace links, Prisma/SDK generation and compiler diagnostic transport; this entry adds no extra process.
 * @evidence contracts/e2e.md#shared-execution The existing BatchWorkspace compiler archive owner supplies the exact already packed SDK/platform bytes to the scenario's distinct generated installation; backend-only packages still pack normally and all controls and claim transitions share that generated workspace.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The awaited scenario owns its generated inputs and unknown-reader retention; this entry starts no parallel reader or mutation.
 * @evidence contracts/e2e.md#preserved-coverage Restores only the ordinary backend activation contract from #1599. Other legacy benchmark tests and measured campaigns remain outside this entry. The TypeScript 7.1 skip returns false, which the executor reports as skipped with no coverage claimed, so the 7.0 lanes keep the full contract.
 */
export async function test_e2e_evidence_batch(): Promise<void | false> {
  const typescript = (
    createRequire(path.join(TestProject.WORKSPACE_ROOT, "package.json"))(
      "typescript/package.json",
    ) as { version: string }
  ).version;
  if (CompilerTarget.lineOf(typescript).line !== "7.0") {
    console.log(
      `test_e2e_evidence_batch: skipped on TypeScript ${typescript}; ` +
        "typia's native transform compiles on the TypeScript 7.0 target only (samchon/ttsc#1804).",
    );
    return false;
  }
  const { compilerArchives } = await BatchWorkspace.open();
  await case_evidence_backend_claims_activate_after_generation(
    undefined,
    compilerArchives,
  );
}
