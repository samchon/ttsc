import { case_evidence_backend_claims_activate_after_generation } from "./evidence/scenes/case_evidence_backend_claims_activate_after_generation";

/**
 * Verifies the backend graph's real generated-workspace activation boundary.
 *
 * This entry restores one deleted ordinary benchmark feature test. It does not
 * re-enroll the dormant legacy Evidence consumer wrappers.
 *
 * 1. Prepare the actual generated todo workspace once through its owning API.
 * 2. Collect disabled controls and every staged claim's activation verdict.
 *
 * @evidence contracts/testing.md#behavioral-verification The scenario judges actual generation and compiler gates, named obligations and generated package-accessor coverage; this entry only supplies discovery.
 * @evidence contracts/testing.md#independent-expectations The scenario owns independently derived instruction, heading and generated-accessor expectations.
 * @evidence contracts/testing.md#distinguishing-cases Disabled owner success, all enabled claim populations and installed package accessor completeness remain distinct scenario assertions.
 * @evidence contracts/testing.md#execution-ownership src/index.ts explicitly selects this batch, which awaits the backend scenario; existing dormant Evidence experiments are not called.
 * @evidence contracts/e2e.md#necessary-boundary The scenario crosses actual materialization, pnpm workspace links, Prisma/SDK generation and compiler diagnostic transport; this entry adds no extra process.
 * @evidence contracts/e2e.md#shared-execution One scenario owns one generated installation and cache reused by all controls and claim transitions; archive sharing is available through its caller argument.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The awaited scenario owns its generated inputs and unknown-reader retention; this entry starts no parallel reader or mutation.
 * @evidence contracts/e2e.md#preserved-coverage Restores only the ordinary backend activation contract from #1599. Other legacy benchmark tests and measured campaigns remain outside this entry.
 */
export async function test_e2e_evidence_batch(): Promise<void> {
  await case_evidence_backend_claims_activate_after_generation();
}
