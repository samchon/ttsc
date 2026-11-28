import crypto from "node:crypto";
import path from "node:path";

import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { WitnessedLoadAnswers } from "./WitnessedLoadAnswers";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
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
  const KIND = "go-workspace-environment";

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
   * A record retains external evidence and omits the disposable selectors whose
   * generation inputs the caller has keyed.
   *
   * @evidence contracts/common.md#principled-implementation The ordinary toolchain hasher runs with the generated workspace as cwd. Only a fully proven local result is persisted, and scratch-only observations remain available for live admission.
   * @evidence contracts/common.md#clear-and-simple-design Actual toolchain hashing stays with the existing environment reader. This member controls workspace record eligibility.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown or delegated workspaces never supply saved authority for omission of native preparation.
   * @evidence contracts/common.md#meaningful-documentation Specifies the difference between live and persisted evidence.
   * @evidence contracts/portability.md#os-neutral-implementation The caller supplies a physical scratch directory. Native path names identify the two generated selectors to exclude from persistence.
   * @evidence contracts/performance.md#efficient-algorithms One native environment-hash operation and one bounded iteration over its witness qualify the answer. The SDK digest owner can reuse observed file bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work The external proof and key allow later requests to skip materialization of local workspaces only.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns scratch lifecycle and the record store owns persisted data.
   */
  export function observe(opts: {
    directory: string;
    env: NodeJS.ProcessEnv;
    filesystem?: Partial<SourceBuildFilesystemOperations>;
    goBinary: string;
    identities?: PluginContentIdentities.Store;
    identity: unknown;
    projectRoot?: string;
  }): {
    value: string;
    witness: PluginBuildEnvironmentWitness.Record;
    qualified: boolean;
    local: boolean;
  } {
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const hash = crypto.createHash("sha256");
    const local = hashPluginBuildEnvironment(
      hash,
      opts.goBinary,
      opts.directory,
      opts.env,
      {
        realpath: opts.filesystem?.realpath,
        readFile: opts.filesystem?.readFile ?? readSourceBuildFile,
      },
      witness,
      opts.identities,
      opts.projectRoot,
    );
    const value = hash.digest("hex");
    const qualified = PluginBuildEnvironmentWitness.reusable(witness);
    if (local && qualified) {
      const external = new Map(witness);
      external.delete(`\0directory:${opts.directory}`);
      external.delete(path.join(opts.directory, "go.mod"));
      external.delete(path.join(opts.directory, "go.work"));
      WitnessedLoadAnswers.write(
        opts.identities,
        KIND,
        opts.identity,
        value,
        external,
      );
    }
    return { value, witness, qualified, local };
  }
}
