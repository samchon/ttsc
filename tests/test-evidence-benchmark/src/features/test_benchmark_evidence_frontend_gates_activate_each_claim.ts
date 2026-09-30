import type { IBenchmarkWorkspace } from "../internal/IBenchmarkWorkspace";
import {
  type IActivationGate,
  readActivationGates,
  readClaimNames,
  readClaimsReferencingAPackage,
  removeActivationGate,
} from "../internal/activationGates";
import { assertClaimActivated } from "../internal/assertClaimActivated";
import { assertPublishedAccessorsDemanded } from "../internal/assertPublishedAccessorsDemanded";
import { acquireBenchmarkWorkspace } from "../internal/benchmarkWorkspace";
import {
  type IClaimConfiguration,
  discoverClaimConfigurations,
} from "../internal/claimConfigurations";
import {
  claimIsUnlockedBy,
  claimUnlockOrder,
} from "../internal/claimUnlockOrder";
import type { IMissingAcknowledgement } from "../internal/evidenceDiagnostics";
import { runScript } from "../internal/runScript";
import { materializeClaimLayer } from "../internal/workspaceLayer";

/** The skill document that prescribes the staged unlock this walk covers. */
const INSTRUCTION =
  "benchmarks/evidence/template/evidence/.agents/skills/evidence/frontend.md";

/**
 * Verifies every staged frontend claim activates in its instructed order, and
 * that the hook obligation enumerates the SDK through the workspace link.
 *
 * The three frontend claims form a chain — a hook answers for the operations it
 * calls, a screen for the hooks it uses, a journey for the screens it walks —
 * so each one references a population the previous layer produces and only the
 * instructed order can observe any of them. The first link is also the one that
 * broke a cohort: it selects the accessor surface out of an installed
 * `package`, and a workspace dependency is a link that pnpm writes as a
 * junction on Windows. A walker that treats that link as a plain entry returns
 * nothing, and a reference that selects nothing reports full coverage of a
 * frontend that calls no API at all.
 *
 * Nothing this case writes carries a citation, so every claim it opens has
 * something to owe. Silence from an enabled claim is the failure.
 *
 * 1. Read the staged claims from the frontend configuration.
 * 2. Order them by the instruction the measured agent receives.
 * 3. For each, write its host layer, delete its marker, and lint the package.
 * 4. Assert the claim reported obligations, and that the claim reaching the
 *    install owed every accessor the SDK publishes.
 *
 * @evidence contracts/testing.md#behavioral-verification Exactly one owner has nonempty fully staged frontend claims and a package reference; each instructed untagged layer activates and package claims demand all nonempty generated accessors.
 * @evidence contracts/testing.md#independent-expectations Frozen frontend instruction establishes order; generator accessor tags define package expectations independently of diagnostic parsing.
 * @evidence contracts/testing.md#distinguishing-cases Wrong owner count, zero claims, staged mismatch and absent package reference fail. Hooks/screens/journeys accumulate; demands assert accessor membership without excluding additional targets.
 * @evidence contracts/testing.md#execution-ownership The matching features export runs via DynamicExecutor with the discovered owner's actual pnpm script per claim.
 * @evidence contracts/e2e.md#necessary-boundary Installed SDK links, host layers, configuration activation and native lint diagnostics must connect rather than only agree in source parsers.
 * @evidence contracts/e2e.md#shared-execution Existing Evidence preparation/pack serve one cumulative walk; changed claims need separate requests and unchanged generated SDK output is retained.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Temporary layers/markers change after tracked-baseline restore and untracked cleanup; ignored install/SDK output remain. Synchronous commands finish before reads and benchmarkWorkspace owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original discovery/staged/package and per-claim activation/accessor checks remain. This body does not build the SDK; nonempty discovery requires retained generated output and fails if absent.
 */
export const test_benchmark_evidence_frontend_gates_activate_each_claim =
  async (): Promise<void> => {
    const workspace: IBenchmarkWorkspace =
      await acquireBenchmarkWorkspace("evidence");
    // Discovered rather than named, so a claim that moves between packages
    // stays covered by the objective whose instruction unlocks it.
    const owners: IClaimConfiguration[] = discoverClaimConfigurations(
      workspace.workspace,
    ).filter((candidate) =>
      candidate.claims.some((claim) => claimIsUnlockedBy(INSTRUCTION, claim)),
    );
    if (owners.length !== 1)
      throw new Error(
        `${String(owners.length)} lint configuration(s) declare a claim that ${INSTRUCTION} unlocks; the frontend graph is declared in exactly one.`,
      );
    const owner: IClaimConfiguration = owners[0]!;
    const configuration: string = owner.file;

    const declared: string[] = readClaimNames(configuration);
    const gates: IActivationGate[] = readActivationGates(configuration);
    // A configuration this suite can no longer read yields nothing, and a walk
    // over nothing passes while proving nothing. Refuse it before the counts
    // agree with each other at zero.
    if (declared.length === 0)
      throw new Error(
        `${configuration} yielded no claim name. Either it declares none, or its shape changed and this suite is no longer reading it.`,
      );
    if (gates.length !== declared.length)
      throw new Error(
        `${configuration} declares ${String(declared.length)} claim(s) but stages ${String(gates.length)}. Every claim ships disabled so a cell unlocks it when its layer is complete.`,
      );

    const throughTheInstall: string[] =
      readClaimsReferencingAPackage(configuration);
    if (throughTheInstall.length === 0)
      throw new Error(
        `${configuration} declares no \`package\` reference. The frontend hook obligation reaches the generated SDK through the install, and that is the reference a workspace link can empty out; if it is gone, this case no longer covers the failure it exists for.`,
      );

    const order: string[] = claimUnlockOrder(
      INSTRUCTION,
      gates.map((gate) => gate.claim),
    );
    for (const claim of order) {
      materializeClaimLayer({ workspace: workspace.workspace, claim });
      removeActivationGate(configuration, claim);
      const obligations: IMissingAcknowledgement[] = assertClaimActivated({
        result: runScript({
          cwd: owner.packageDirectory,
          script: owner.script,
        }),
        claim,
      });
      if (throughTheInstall.includes(claim))
        assertPublishedAccessorsDemanded({ workspace, claim, obligations });
    }
  };
