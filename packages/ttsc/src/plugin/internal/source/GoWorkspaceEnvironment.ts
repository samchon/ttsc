import crypto from "node:crypto";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";
import { GoEnvironmentReading } from "./GoEnvironmentReading";
import { GoToolResolution } from "./GoToolResolution";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { WitnessedLoadAnswers } from "./WitnessedLoadAnswers";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { isPathWithin } from "./isPathWithin";
import { readSourceBuildFile } from "./readSourceBuildFile";

/**
 * Establish the environment of the generated workspace that Go actually uses.
 * Only a workspace handled by the launcher itself can skip later preparation.
 *
 * @evidence contracts/common.md#principled-implementation Workspace requirements and toolchain selection belong to actual Go. A later request reuses a local result only under unchanged external metadata and an identity covering every input used to generate the workspace.
 * @evidence contracts/common.md#clear-and-simple-design The same workspace observation serves source binaries and package selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Delegated workspace answers require fresh preparation because Go can consult a changing list of available releases while generating the workspace.
 * @evidence contracts/common.md#meaningful-documentation Identifies which workspace is read and when preparation can be omitted.
 * @evidence contracts/portability.md#os-neutral-implementation Native Go and the environment witness own tool selection and path identity.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The members own observation and answer replay costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The members document the scope of qualified sharing.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no resource or in-memory state.
 */
export namespace GoWorkspaceEnvironment {
  const KIND = "go-workspace-environment-v3";

  /**
   * Skip a generated workspace probe only when the explicit local setting has
   * native origin evidence and GOENV is independent of the working directory.
   * The caller separately validates that evidence.
   *
   * @evidence contracts/common.md#principled-implementation Explicit local disables Go's automatic dispatch. An earlier unproved reading cannot establish which executable or SDK will handle the workspace.
   * @evidence contracts/common.md#clear-and-simple-design Binary and package selection reuse the same shortcut decision.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A requested Go mode alone cannot make a failed native query into evidence.
   * @evidence contracts/common.md#meaningful-documentation States the two prerequisites and the caller's responsibility for validity.
   * @evidence contracts/portability.md#os-neutral-implementation The shared environment accessor uses native variable identity on Windows and POSIX.
   * @evidence contracts/performance.md#efficient-algorithms One environment lookup and one marker check require no new subprocess or SDK walk.
   * @evidence contracts/performance.md#reuse-equivalent-work Only proved explicit local origin settings can bypass workspace observation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains no resource or verdict.
   */
  export function canUseOrigin(
    env: NodeJS.ProcessEnv,
    witness: PluginBuildEnvironmentWitness.Record,
  ): boolean {
    return (
      SidecarEnvironment.read(env, "GOTOOLCHAIN") === "local" &&
      !GoEnvironmentReading.hasRelativeFile(env) &&
      PluginBuildEnvironmentWitness.hasToolchainProof(witness)
    );
  }

  /**
   * Refine the binary key when the generated workspace uses a different
   * environment. Unqualified observations need an identity unique to this
   * build.
   *
   * @evidence contracts/common.md#principled-implementation The base key already identifies the source environment. A different observed environment adds an independent content component, and a nonce makes an unqualified observation ineligible for adoption of another binary.
   * @evidence contracts/common.md#clear-and-simple-design One key constructor serves the binary cache and its native regression.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No prior stable key is returned for unproved workspace environment.
   * @evidence contracts/common.md#meaningful-documentation States when the key remains unchanged and when a build needs an exclusive identity.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The operation hashes text and does not interpret native paths.
   * @evidence contracts/performance.md#efficient-algorithms Equality uses the supplied digests. Other cases hash their framed bytes once.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal source and workspace digests share verified binary identities; unqualified content never authorizes sharing.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The key constructor retains no data or handles.
   */
  export function binaryKey(
    originKey: string,
    sourceEnvironment: string | undefined,
    workspace: string,
    qualified: boolean,
  ): string {
    if (qualified && workspace === sourceEnvironment) return originKey;
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          originKey,
          workspace,
          qualified ? null : crypto.randomUUID(),
        ]),
      )
      .digest("hex")
      .slice(0, 32);
  }

  /**
   * Replay an unchanged local workspace under the same generation inputs.
   *
   * @evidence contracts/common.md#principled-implementation The recorded answer validates the complete external witness before giving the caller its environment and evidence.
   * @evidence contracts/common.md#clear-and-simple-design The shared answer store owns files and validation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing or moved reading supplies no answer.
   * @evidence contracts/common.md#meaningful-documentation States the generation-input prerequisite and returned authority.
   * @evidence contracts/portability.md#os-neutral-implementation The answer store validates native path and environment observations.
   * @evidence contracts/performance.md#efficient-algorithms One stored lookup and one validation of its external observations need no worktree or subprocess.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal generation inputs share this local workspace reading across processes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The answer store owns persistent records.
   */
  export function recall(
    identities: PluginContentIdentities.Store | undefined,
    identity: unknown,
  ):
    | { value: string; witness: PluginBuildEnvironmentWitness.Record }
    | undefined {
    return WitnessedLoadAnswers.read(
      identities,
      KIND,
      identity,
      (value): value is string => typeof value === "string",
    );
  }

  /**
   * Read the materialized workspace. The returned proof includes its own files.
   * The caller separately decides whether those files match the cache key.
   *
   * @evidence contracts/common.md#principled-implementation The ordinary toolchain hasher runs with the generated workspace as cwd and validates the resulting observations.
   * @evidence contracts/common.md#clear-and-simple-design The existing reader hashes the actual SDK; this operation returns live evidence separately from publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observation alone publishes no answer and does not widen a string-only custom SDK reader to native byte paths.
   * @evidence contracts/common.md#meaningful-documentation Specifies the caller's responsibility to compare the materialized inputs against the key.
   * @evidence contracts/portability.md#os-neutral-implementation The native reader supplies both ordinary and raw POSIX byte paths by default. An injected ordinary reader keeps its own byte-path policy.
   * @evidence contracts/performance.md#efficient-algorithms One native environment-hash operation and one bounded iteration over its witness qualify the answer. The SDK digest owner can reuse observed file bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work The SDK reader can retain qualified byte identities; the workspace itself is observed live.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns scratch lifecycle and the returned observation.
   */
  export function observe(opts: {
    directory: string;
    env: NodeJS.ProcessEnv;
    filesystem?: Partial<SourceBuildFilesystemOperations>;
    goBinary: string;
    identities?: PluginContentIdentities.Store;
    projectRoot?: string;
  }): {
    value: string;
    witness: PluginBuildEnvironmentWitness.Record;
    qualified: boolean;
    local: boolean;
    replayable: boolean;
  } {
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const hash = crypto.createHash("sha256");
    const relative = GoEnvironmentReading.hasRelativeFile(opts.env);
    const acquire = () =>
      hashPluginBuildEnvironment(
        hash,
        opts.goBinary,
        opts.directory,
        opts.env,
        {
          realpath: opts.filesystem?.realpath,
          readFile: opts.filesystem?.readFile ?? readSourceBuildFile,
          readRawFile:
            opts.filesystem?.readRawFile ??
            (opts.filesystem?.readFile === undefined
              ? readSourceBuildFile
              : undefined),
        },
        witness,
        opts.identities,
        opts.projectRoot,
      );
    const local = relative
      ? GoEnvironmentReading.withRecoveryProjection(
          (entries) => externalWitness(opts.directory, entries, opts.env),
          acquire,
        )
      : acquire();
    const value = hash.digest("hex");
    const qualified = PluginBuildEnvironmentWitness.reusable(witness);
    return {
      value,
      witness,
      qualified,
      local,
      replayable: local && !relative,
    };
  }

  /**
   * Save local workspace evidence after the caller proves the generated inputs
   * match its key. Keep external evidence beyond the scratch directory's life.
   *
   * @evidence contracts/common.md#principled-implementation Only local workspace observations that still hold qualify. The caller proves the content identity before invoking publication.
   * @evidence contracts/common.md#clear-and-simple-design The observation owner delegates durable publication to the caller's content-validation boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The three disposable observations are dropped only after live validation. External SDK evidence remains validated by the store.
   * @evidence contracts/common.md#meaningful-documentation States the caller's precondition and why scratch observations are removed.
   * @evidence contracts/portability.md#os-neutral-implementation Native joined paths identify the two generated selectors, and the witness checks native metadata.
   * @evidence contracts/performance.md#efficient-algorithms Checks the live observations before copying the witness map and removing scratch selectors. The store validates the external entries again at publication.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal generation inputs can replay the persisted local proof under unchanged external observations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The shared answer store retains the persisted record and the caller owns the scratch directory.
   */
  export function remember(
    identities: PluginContentIdentities.Store | undefined,
    identity: unknown,
    directory: string,
    observation: ReturnType<typeof observe>,
  ): void {
    if (
      !observation.replayable ||
      !observation.qualified ||
      !PluginBuildEnvironmentWitness.reusable(observation.witness)
    )
      return;
    WitnessedLoadAnswers.write(
      identities,
      KIND,
      identity,
      observation.value,
      externalWitness(directory, observation.witness),
    );
  }

  /**
   * Keep the external observations from a live workspace proof. The caller
   * separately checks the generated inputs while their directory still exists.
   *
   * @evidence contracts/common.md#principled-implementation Excludes the physical scratch directory, its two generated selectors and a relative settings file physically owned by scratch.
   * @evidence contracts/common.md#clear-and-simple-design One projection serves durable proofs and outer build consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Removing scratch observations does not validate any external metadata.
   * @evidence contracts/common.md#meaningful-documentation Identifies the omitted inputs and the caller's validation responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation Native path joins identify the two module and workspace selectors.
   * @evidence contracts/performance.md#efficient-algorithms Copies the witness map and removes three fixed keys. A relative GOENV can also query its candidate and existing native ancestors.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Projection does not cache its own result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the result.
   */
  export function externalWitness(
    directory: string,
    witness: PluginBuildEnvironmentWitness.Record,
    env?: NodeJS.ProcessEnv,
  ): PluginBuildEnvironmentWitness.Record {
    const external = new Map(witness);
    external.delete(`\0directory:${directory}`);
    external.delete(path.join(directory, "go.mod"));
    external.delete(path.join(directory, "go.work"));
    if (env !== undefined && GoEnvironmentReading.hasRelativeFile(env)) {
      const file = GoToolResolution.workingPath(
        directory,
        SidecarEnvironment.read(env, "GOENV")!,
      );
      if (external.has(file) && insideScratch(file, directory))
        external.delete(file);
    }
    return external;
  }

  /** Resolve the existing prefix without cleaning POSIX parent components. */
  function insideScratch(file: string, scratch: string): boolean {
    for (let current = file; ; current = path.dirname(current)) {
      try {
        const physical = RuntimeFilesystem.realpathWitness(current);
        return !physical.includes("\0") && isPathWithin(physical, scratch);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== "ENOENT" ||
          path.dirname(current) === current ||
          path.basename(current) === ".."
        )
          return false;
      }
    }
  }
}
