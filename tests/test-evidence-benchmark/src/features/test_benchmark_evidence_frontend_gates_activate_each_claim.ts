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
