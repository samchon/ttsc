import fs from "node:fs";
import path from "node:path";

import { RuntimeEmitBundle } from "../../../compiler/internal/build/RuntimeEmitBundle";
import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { ProcessOwnedDirectory } from "./ProcessOwnedDirectory";
import { RuntimeFilesystem } from "./RuntimeFilesystem";
import { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";

/**
 * The directory dependency builds are cached under.
 *
 * A plugin-descriptor evaluator keeps its builds beside its own result file, so
 * the parent's cleanup of that evaluation removes them too. Otherwise the first
 * manifest's per-run `depCacheDir` is used, shared by every process of one run
 * and removed with it.
 *
 * Without any manifest there is no run to share with: a child whose environment
 * dropped `TTSX_RUNTIME_MANIFEST`, or one that loads its first TypeScript after
 * the launcher removed the manifest. Its builds go to a directory private to
 * this process with removal attempted by one exit callback. A shared directory
 * keyed only by the tsconfig path would let an edited dependency keep running
 * its first build until the temp directory was cleared. A later manifest-less
 * acquisition attempts to sweep recognized abandoned process directories;
 * unknown, unowned or non-gone records and native failures can remain
 * indefinitely. Canonical spellings protect against retargeting the original
 * alias, not replacement of the observed physical namespace. Descriptor/run
 * root cleanup is the selecting caller's responsibility, not an outcome
 * certified here.
 *
 * @param env Environment to read the descriptor-evaluation variables from.
 * @param projectRoot Project whose emitted dependencies need private storage.
 * @evidence contracts/common.md#principled-implementation Descriptor, checked-run and manifest-less directories have distinct owners. A manifest-less candidate needs an ordinary and project-free deterministic parent before exclusive child acquisition and owner publication.
 * @evidence contracts/common.md#clear-and-simple-design The selector owns the three execution contexts. The namespace's single-candidate native claim is separate from retry, sweep and exit cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing manifest selects a genuinely process-owned cache. Existing aliases and project overlap cannot supply ownership, and failed rollback cannot advance as a clean refusal.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain descriptor, run and process ownership and cleanup after forced termination, with the injected environment documented following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Environment selection follows native Windows alias rules. Native realpath/mkdtemp postflight selects a physical temp child; preserving that namespace and distinct host-label ownership remain premises, not path-handle guarantees.
 * @evidence contracts/performance.md#efficient-algorithms Environment/path selection processes its key/text inputs. Registry access may first read/decode/snapshot inherited manifest bytes or rebuild its M-entry view, then selection scans until a cache is found. First manifest-less acquisition pays sibling names/records/native probes and canonical-child IO; later orphan requests reuse the stored root but still perform context selection.
 * @evidence contracts/performance.md#reuse-equivalent-work Manifest-less builds reuse the current process-owned directory while it still qualifies for their project. Descriptor and run roots share only their explicit owning evaluation or run.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A new project can disqualify the current private directory. Each accepted directory retains its own exit cleanup. Failed admission attempts rollback and can report both admission and cleanup errors. Canonical acquisition can fail before that rollback scope. Exit cleanup and later sweeps remain best effort.
 */
export function dependencyCacheRoot(
  env: NodeJS.ProcessEnv = process.env,
  projectRoot: string = process.cwd(),
): string {
  // Descriptor evaluators are disposable and must not leave one isolated emit
  // generation in the shared temp cache per load. Their result file already
  // lives in the evaluator-owned directory that the parent removes in
  // `finally`; put dependency emits beside it so that cleanup owns both.
  const descriptorOutput = SidecarEnvironment.read(
    env,
    "TTSC_PLUGIN_DESCRIPTOR_OUT",
  );
  if (
    SidecarEnvironment.read(env, "TTSC_PLUGIN_DESCRIPTOR_LOAD") === "1" &&
    descriptorOutput !== undefined &&
    path.isAbsolute(descriptorOutput)
  ) {
    return path.join(path.dirname(descriptorOutput), "dependency-cache");
  }
  const owner = RuntimeManifestRegistry.runtimeManifests().find(
    (candidate) => candidate.depCacheDir.length !== 0,
  );
  return owner !== undefined
    ? owner.depCacheDir
    : processPrivateRoot(projectRoot);
}

/** Prefix of a per-process directory's name, which the sweep recognizes. */
const PROCESS_ROOT_PREFIX = "process-";

let processRoot: string | undefined;

/**
 * This process's private dependency cache, created on first use with an owner
 * record, and removed on exit. Creating it first sweeps the directories of
 * processes on this host that are gone.
 */
function processPrivateRoot(projectRoot: string): string {
  const projectRoots = [projectRoot, process.cwd()];
  let refusal: unknown;
  try {
    if (
      processRoot !== undefined &&
      systemTempOutsideProject.allowsChild(
        path.dirname(processRoot),
        projectRoots,
      ) &&
      fs.lstatSync(processRoot, { throwIfNoEntry: false })?.isDirectory() ===
        true &&
      RuntimeFilesystem.realpathWitness(processRoot) === processRoot
    ) {
      fs.accessSync(processRoot, fs.constants.W_OK | fs.constants.X_OK);
      return processRoot;
    }
  } catch (error) {
    if (!SourceBuildCacheLayout.refusesDefaultPath(error)) throw error;
    refusal = error;
  }
  let directory: string | undefined;
  for (const candidate of systemTempOutsideProject.candidates(
    projectRoot,
    projectRoots,
  )) {
    try {
      directory = dependencyCacheRoot.claimUnderTemporary(
        candidate.directory,
        projectRoots,
      );
      if (directory !== undefined) break;
    } catch (error) {
      if (!SourceBuildCacheLayout.refusesDefaultPath(error)) throw error;
      refusal ??= error;
    }
  }
  if (directory === undefined)
    throw (
      refusal ??
      new Error(`ttsx: no private dependency cache outside ${projectRoot}`)
    );
  const owned = directory;
  const parent = path.dirname(owned);
  ProcessOwnedDirectory.sweep(
    parent,
    (name) => {
      if (!name.startsWith(PROCESS_ROOT_PREFIX)) return false;
      const sibling = path.join(parent, name);
      try {
        return (
          fs.lstatSync(sibling, { throwIfNoEntry: false })?.isDirectory() ===
            true && systemTempOutsideProject.allowsChild(sibling, projectRoots)
        );
      } catch {
        return false;
      }
    },
    true,
  );
  process.once("exit", () => {
    try {
      // The builds below were served through descriptors this process holds.
      RuntimeEmitBundle.release();
      fs.rmSync(owned, { force: true, recursive: true });
    } catch {
      // Best effort: the next manifest-less process sweeps what remains.
    }
  });
  processRoot = owned;
  return owned;
}

/**
 * Native admission for one qualified system temp candidate.
 *
 * @evidence contracts/common.md#principled-implementation Ordinary directory observations and project qualification precede exclusive allocation and owner publication.
 * @evidence contracts/common.md#clear-and-simple-design A single-candidate claim stays separate from caller-owned retries, sweeping and exit cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An alias or project overlap cannot supply an accepted parent. A rollback failure preserves both errors and prevents retry.
 * @evidence contracts/common.md#meaningful-documentation The claim describes its ineligibility and rollback outcomes.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat, lossless realpath and the canonical creator validate directory identity on supported platforms.
 * @evidence contracts/performance.md#efficient-algorithms Directory qualification walks ancestry without enumeration. An acquired directory writes one owner record before transfer.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each accepted directory is exclusively allocated for one claim.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns an accepted directory. Failed publication attempts rollback, whose error can leave the directory behind.
 */
export namespace dependencyCacheRoot {
  /**
   * Create an ordinary dependency parent and admit one exclusive process root.
   * A project-owned or linked parent is ineligible. A failed owner write
   * removes the acquired directory before its permission error can request a
   * new candidate.
   */
  export function claimUnderTemporary(
    temporary: string,
    projectRoots: readonly string[],
  ): string | undefined {
    const parent = path.join(temporary, "ttsx-dep");
    if (!systemTempOutsideProject.allowsChild(parent, projectRoots))
      return undefined;
    const present = fs.lstatSync(parent, { throwIfNoEntry: false });
    if (
      (present !== undefined && !present.isDirectory()) ||
      RuntimeFilesystem.realpathWitness(temporary) !== temporary
    )
      return undefined;
    try {
      fs.mkdirSync(parent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (
      !fs.lstatSync(parent).isDirectory() ||
      RuntimeFilesystem.realpathWitness(parent) !== parent
    )
      throw new Error(`ttsx: unsafe private dependency cache: ${parent}`);
    if (!systemTempOutsideProject.allowsChild(parent, projectRoots))
      return undefined;
    const directory = createCanonicalTempDirectory(
      `${PROCESS_ROOT_PREFIX}${process.pid}-`,
      parent,
    );
    try {
      ProcessOwnedDirectory.admit(directory, process.pid);
    } catch (error) {
      try {
        fs.rmSync(directory, { recursive: true });
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "ttsx: failed to admit and remove the private dependency cache",
        );
      }
      throw error;
    }
    return directory;
  }
}
