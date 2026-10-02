import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { ProcessOwnedDirectory } from "./ProcessOwnedDirectory";
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
 * this process with removal attempted by one exit callback. A shared directory keyed
 * only by the tsconfig path would let an edited dependency keep running its
 * first build until the temp directory was cleared. A later manifest-less
 * acquisition attempts to sweep recognized abandoned process directories;
 * unknown, unowned or non-gone records and native failures can remain indefinitely.
 * Canonical spellings protect against retargeting the original alias, not
 * replacement of the observed physical namespace. Descriptor/run root cleanup
 * is the selecting caller's responsibility, not an outcome certified here.
 *
 * @param env Environment to read the descriptor-evaluation variables from.
 *
 * @evidence contracts/common.md#principled-implementation Descriptor-owned output, a checked run's depCacheDir and a manifest-less process directory are distinct lifetime authorities; selecting in that order keeps dependency emit with the owner that removes it.
 * @evidence contracts/common.md#clear-and-simple-design One root selector owns the three supported execution contexts, with process-directory acquisition isolated in a private helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing manifest selects a genuinely process-owned cache rather than persistent path-only reuse; descriptor channels are explicit host inputs, not fixture-specific names.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain descriptor, run and process ownership and cleanup after forced termination, with the injected environment documented following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Environment selection follows native Windows alias rules. Native realpath/mkdtemp postflight selects a physical temp child; preserving that namespace and distinct host-label ownership remain premises, not path-handle guarantees.
 * @evidence contracts/performance.md#efficient-algorithms Environment/path selection processes its key/text inputs. Registry access may first read/decode/snapshot inherited manifest bytes or rebuild its M-entry view, then selection scans until a cache is found. First manifest-less acquisition pays sibling names/records/native probes and canonical-child IO; later orphan requests reuse the stored root but still perform context selection.
 * @evidence contracts/performance.md#reuse-equivalent-work All manifest-less dependency builds in one process share its lazily acquired root; descriptor and run roots share only their explicit owning evaluation or run, avoiding cross-run stale path-only cache reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The process retains one private directory and exit callback. Failed admission attempts rollback and can report combined admission/removal failure; canonical acquisition can fail before this rollback scope. Exit cleanup and later admitted sweeping are best effort, with no historical quota or guaranteed reclamation time; descriptor/run roots transfer cleanup to their owners.
 */
export function dependencyCacheRoot(
  env: NodeJS.ProcessEnv = process.env,
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
  return owner !== undefined ? owner.depCacheDir : processPrivateRoot();
}

/** Parent of the per-process directories of manifest-less runtimes. */
const PROCESS_ROOT_PARENT = path.join(os.tmpdir(), "ttsx-dep");

/** Prefix of a per-process directory's name, which the sweep recognizes. */
const PROCESS_ROOT_PREFIX = "process-";

let processRoot: string | undefined;

/**
 * This process's private dependency cache, created on first use with an owner
 * record, and removed on exit. Creating it first sweeps the directories of
 * processes on this host that are gone.
 */
function processPrivateRoot(): string {
  if (processRoot !== undefined) return processRoot;
  ProcessOwnedDirectory.sweep(
    PROCESS_ROOT_PARENT,
    (name) => name.startsWith(PROCESS_ROOT_PREFIX),
    true,
  );
  fs.mkdirSync(PROCESS_ROOT_PARENT, { recursive: true });
  const directory = createCanonicalTempDirectory(
    `${PROCESS_ROOT_PREFIX}${process.pid}-`,
    PROCESS_ROOT_PARENT,
  );
  try {
    ProcessOwnedDirectory.admit(directory, process.pid);
  } catch (error) {
    try {
      fs.rmSync(directory, { force: true, recursive: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "ttsx: failed to admit and remove the private dependency cache",
      );
    }
    throw error;
  }
  process.once("exit", () => {
    try {
      fs.rmSync(directory, { force: true, recursive: true });
    } catch {
      // Best effort: the next manifest-less process sweeps what remains.
    }
  });
  processRoot = directory;
  return directory;
}
