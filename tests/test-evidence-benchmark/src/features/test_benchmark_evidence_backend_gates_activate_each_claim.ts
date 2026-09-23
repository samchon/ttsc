import path from "node:path";

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
import { provisionEnvironment } from "../internal/provisionEnvironment";
import { requirementDocumentsDeclaringSections } from "../internal/requirementDocuments";
import { runScript } from "../internal/runScript";
import { stripCitations } from "../internal/stripCitations";
import { materializeClaimLayer } from "../internal/workspaceLayer";

/** The skill document that prescribes the staged unlock this walk covers. */
const INSTRUCTION =
  "benchmarks/evidence/template/evidence/.agents/skills/evidence/backend.md";

/**
 * Verifies every staged backend claim really activates when its marker is
 * removed, one layer at a time.
 *
 * Deleting `disabled` is the Evidence arm's one prescribed edit to a frozen
 * configuration, and it is the moment the treatment either starts working or
 * silently stops existing. A claim that goes quiet when enabled looks exactly
 * like a claim that is satisfied: both exit zero. That is how a `package`
 * reference walking a pnpm junction as a plain entry voided a cohort — every
 * population came back empty, and an empty population demands nothing. So each
 * step asserts the claim demanded something, against a workspace that
 * acknowledges nothing at all: the layers written here carry no citation, and
 * the one citation the overlay ships is removed first.
 *
 * Claim-level activation alone would not have caught that cohort's defect. The
 * claim reaching the installed SDK also references the delivered requirements,
 * and that reference stays healthy, so the claim keeps reporting and keeps
 * looking active while the population reached through the install is empty.
 * Every claim declaring a `package` reference is therefore held to naming each
 * accessor the generator published.
 *
 * The order is read from the instruction the measured agent receives rather
 * than fixed here, because the order is a real property of the graph: a claim
 * enabled before the layer it references exists selects nothing.
 *
 * 1. Build the workspace far enough that every claim's population can exist.
 * 2. Assert every declared claim ships staged.
 * 3. For each claim in the instructed order, write its host layer, delete its
 *    marker, and run the gate that compiles the Program owning its hosts.
 * 4. Assert the claim reported obligations, that its requirement reference reached
 *    every delivered document declaring a section, and that a package reference
 *    owed every published accessor.
 */
export const test_benchmark_evidence_backend_gates_activate_each_claim =
  async (): Promise<void> => {
    const workspace: IBenchmarkWorkspace =
      await acquireBenchmarkWorkspace("evidence");
    provisionEnvironment(workspace.workspace);
    const backend: string = path.join(
      workspace.workspace,
      "packages",
      "backend",
    );

    // The generated Prisma client and the generated SDK are what the package
    // and test Programs compile against; without them a gate fails on a missing
    // module rather than on an evidence obligation.
    for (const script of ["build:prisma", "build:sdk"])
      requireZero(backend, script);

    // Discovered rather than named. Which package declares which claim is a
    // template decision that has already moved once; a case that named the two
    // backend configurations would keep passing after the next move while
    // covering fewer claims than it did before.
    const configurations: IClaimConfiguration[] = discoverClaimConfigurations(
      workspace.workspace,
    ).filter((configuration) =>
      configuration.claims.some((claim) =>
        claimIsUnlockedBy(INSTRUCTION, claim),
      ),
    );
    if (configurations.length === 0)
      throw new Error(
        `No lint configuration in the prepared workspace declares a claim that ${INSTRUCTION} unlocks. Either the arm no longer stages a backend graph, or this suite is no longer finding it.`,
      );
    const gates: IActivationGate[] = readStagedClaims(
      configurations.map((configuration) => configuration.file),
    );
    const throughTheInstall: string[] = configurations.flatMap(
      (configuration) => readClaimsReferencingAPackage(configuration.file),
    );
    if (throughTheInstall.length === 0)
      throw new Error(
        `No configuration this objective unlocks declares a \`package\` reference. That is the reference an unwalkable workspace link empties out, and without it this walk no longer covers the failure it exists for.`,
      );
    // The overlay's e2e test already cites the one published operation, and a
    // satisfied obligation is indistinguishable from one that does not exist.
    // Every claim below must therefore be walked against a workspace that
    // acknowledges nothing at all.
    stripCitations(path.join(backend, "test", "features"));

    const order: string[] = claimUnlockOrder(
      INSTRUCTION,
      gates.map((gate) => gate.claim),
    );
    for (const claim of order) {
      const gate: IActivationGate = locate(gates, claim);
      materializeClaimLayer({ workspace: workspace.workspace, claim });
      removeActivationGate(gate.file, claim);

      // A claim populates only from the Program that owns its hosts, so the
      // gate that proves it is the one compiling that Program — which is the
      // script its own configuration carries.
      const owner: IClaimConfiguration = owning(configurations, gate.file);
      // Mirrors the workspace-root `lint` script, which regenerates the Prisma
      // client before linting so a schema edit cannot leave the Program stale.
      requireZero(backend, "build:prisma");
      const obligations: IMissingAcknowledgement[] = assertClaimActivated({
        result: runScript({
          cwd: owner.packageDirectory,
          script: owner.script,
        }),
        claim,
      });
      assertRequirementsReached(workspace.workspace, claim, obligations);
      // Claim-level activation is not enough for a claim that also references
      // an installed package: its Markdown reference stays healthy and keeps
      // reporting, so the claim looks active while the population that reaches
      // through the install has gone empty. Only naming the accessors separates
      // those two states.
      if (throughTheInstall.includes(claim))
        assertPublishedAccessorsDemanded({ workspace, claim, obligations });
    }
  };

/**
 * Reads every claim's activation marker and requires every claim to ship
 * staged.
 *
 * A claim that ships enabled floods a cell's context with errors for tags the
 * instruction told it not to write yet.
 */
const readStagedClaims = (configurations: readonly string[]) => {
  const gates: IActivationGate[] = [];
  for (const file of configurations) {
    const declared: string[] = readClaimNames(file);
    const staged: IActivationGate[] = readActivationGates(file);
    // A configuration this suite can no longer read yields nothing, and a walk
    // over nothing passes while proving nothing. Refuse it before the counts
    // agree with each other at zero.
    if (declared.length === 0)
      throw new Error(
        `${file} yielded no claim name. Either it declares none, or its shape changed and this suite is no longer reading it.`,
      );
    if (staged.length !== declared.length)
      throw new Error(
        `${file} declares ${String(declared.length)} claim(s) but stages ${String(staged.length)}. Every claim ships disabled so a cell unlocks it when its layer is complete.`,
      );
    gates.push(...staged);
  }
  return gates;
};

/**
 * Fails when a requirement reference reached only part of the delivered
 * documents.
 *
 * The Markdown references reach out of the package into `docs/analysis/`, which
 * the runner copies byte-for-byte from the frozen requirements. A reference
 * that selects some documents and not others narrows the obligation without
 * saying so — the same silent shrinkage as an empty population, one document at
 * a time — and a reference that named a document the workspace does not carry
 * resolved against something other than the delivered requirements.
 *
 * Documents are matched by file name rather than by the whole address. A
 * Markdown target is spelled relative to the root its reference declares, and
 * these references declare roots that climb out of the package; pinning the
 * exact prefix would make this assert the addressing convention instead of the
 * property, and fail for a reason that has nothing to do with coverage.
 */
const assertRequirementsReached = (
  workspace: string,
  claim: string,
  obligations: readonly IMissingAcknowledgement[],
): void => {
  const reached = new Set<string>();
  for (const obligation of obligations) {
    const separator: number = obligation.target.indexOf("#");
    const file: string =
      separator === -1
        ? obligation.target
        : obligation.target.slice(0, separator);
    if (file.endsWith(".md")) reached.add(file);
  }
  // A claim whose references are all Prisma or TypeScript owes no document at
  // all; only a claim that reached one is held to reaching them all.
  if (reached.size === 0) return;
  const expected: string[] = requirementDocumentsDeclaringSections(workspace);
  const named = (document: string): boolean => {
    const basename: string = document.slice(document.lastIndexOf("/") + 1);
    return [...reached].some(
      (file) => file === document || file.endsWith(`/${basename}`),
    );
  };
  const missing: string[] = expected.filter((document) => !named(document));
  if (missing.length !== 0)
    throw new Error(
      `Claim '${claim}' demanded evidence from ${String(reached.size)} of the ${String(expected.length)} delivered requirement documents; nothing was owed for ${missing.join(", ")}.`,
    );
  const delivered: string[] = expected.map((document) =>
    document.slice(document.lastIndexOf("/") + 1),
  );
  for (const file of reached)
    if (!delivered.some((basename) => file.endsWith(basename)))
      throw new Error(
        `Claim '${claim}' demanded evidence from '${file}', which is not a delivered requirement document. The reference resolved against something other than \`docs/analysis/\`.`,
      );
};

const owning = (
  configurations: readonly IClaimConfiguration[],
  file: string,
): IClaimConfiguration => {
  const found: IClaimConfiguration | undefined = configurations.find(
    (configuration) => configuration.file === file,
  );
  if (found === undefined)
    throw new Error(`No discovered configuration owns ${file}.`);
  return found;
};

const locate = (
  gates: readonly IActivationGate[],
  claim: string,
): IActivationGate => {
  const found: IActivationGate | undefined = gates.find(
    (gate) => gate.claim === claim,
  );
  if (found === undefined)
    throw new Error(`No activation marker was read for claim '${claim}'.`);
  return found;
};

const requireZero = (cwd: string, script: string): void => {
  const result = runScript({ cwd, script });
  if (result.status === 0) return;
  throw new Error(
    `\`pnpm ${script}\` must pass before any claim can be walked; the activation of every later claim is unobservable until it does.\n\nDirectory: ${cwd}\nExit status: ${String(result.status)}\n\nActual output:\n${result.output}`,
  );
};
