import fs from "node:fs";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../internal/OwnedSynchronousProcess";
import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { createProjectTempDirectory } from "../../internal/createProjectTempDirectory";
import { SourceBuildCacheLayout } from "../../plugin/internal/source/SourceBuildCacheLayout";
import { selectedRecordIdentityTempParent } from "../../plugin/internal/source/selectedRecordIdentityTempParent";
import type { CapturedProcessOutput } from "./CapturedProcessOutput";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";

/**
 * Acquire two private files and descriptors for a child's output.
 *
 * File descriptors avoid spawnSync's piped maxBuffer ceiling. Reading after
 * exit still allocates complete output and is subject to filesystem, Buffer and
 * string limits; file capture does not make output unbounded.
 *
 * The directory is per-call, so ordinary concurrent captures use separate
 * destinations. A descriptor child with a selected record root captures below
 * its existing identities directory, keeping a project-root TEMP from changing
 * the missing-input proof during evaluation. A source-plugin build can instead
 * supply its own capture directory inside its held cache lock. Other callers
 * use system temp outside project boundaries. A refused descriptor record
 * parent falls back to system temp, while a lock-owned directory must succeed.
 * A null project root identifies a command that reads no project. Marked
 * project directories are still excluded from system temp selection.
 *
 * This is not held-directory protection against namespace mutation. Descriptor
 * acquisition failures attempt rollback; cleanup failures are suppressed, and
 * the temp creator can leave an unclaimed postflight allocation. The caller
 * owns the returned capture and must dispose it after reading; read failures
 * propagate, while disposal is idempotent and cleanup is best effort.
 *
 * @evidence contracts/common.md#principled-implementation Precreated files receive exact child stream bytes through inherited descriptors. An explicit directory is exclusively created within the calling build's held cache lock and has no fallback. A refusal at the descriptor's automatic identities directory can fall back to qualified system temp. Decoding happens on read, and I/O errors cannot masquerade as empty successful output.
 * @evidence contracts/common.md#clear-and-simple-design One capture owns two descriptors and their private directory. The shared record-parent selector checks the descriptor's existing cache before allocation; acquisition rollback and disposal share cleanup helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported Node filesystem and descriptor APIs capture diagnostics without foreign mutation, expected-output substitution or an arbitrary output ceiling; an absent or invalid private root does not invent a cache.
 * @evidence contracts/common.md#meaningful-documentation Separate purpose, placement, limits and ownership paragraphs explain the descriptor-only placement and actual failure effects rather than claiming unlimited output.
 * @evidence contracts/portability.md#os-neutral-implementation The shared selector confirms an ordinary physical identities child through native realpath and link-preserving stat; canonical temporary-directory ownership and path.join represent native paths. Removal remains best effort because inherited Windows handles may keep files live.
 * @evidence contracts/performance.md#efficient-algorithms Record and system parent qualification inspect the supplied roots and candidate ancestors. A permission refusal can try another qualified location before opening the two capture files. Parent/path text and native lookups contribute cost. Reading B bytes and optional decoding allocate complete raw/output text in O(B) storage, with no output-byte quota.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each child requires independent effectful output destinations; sharing prior captures would mix bytes and ownership rather than reuse equivalent work.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One accepted directory and two descriptors transfer to the capture until disposal. Acquisition rollback/disposal attempt close/removal; errors are suppressed, so closure and file reclamation can remain unconfirmed. Disposal marks itself consumed before cleanup and does not retry; caller-reachable capture closures retain path/state references until discarded. Output bytes are uncapped here.
 */
export function captureProcessOutput(
  env: NodeJS.ProcessEnv = process.env,
  ownedDirectory?: string,
  projectRoot: string | null = process.cwd(),
  additionalProjectRoots: readonly string[] = [],
): CapturedProcessOutput {
  if (ownedDirectory !== undefined) {
    fs.mkdirSync(ownedDirectory);
    return openCapture(ownedDirectory);
  }
  const recordRoot =
    env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1"
      ? SidecarEnvironment.read(env, "TTSC_PLUGIN_RECORD_ROOT")
      : undefined;
  const recordParent = selectedRecordIdentityTempParent(recordRoot, [
    ...OwnedSynchronousProcess.additionalProjectRoots(),
    ...additionalProjectRoots,
    ...(projectRoot === null ? [] : [projectRoot, process.cwd()]),
  ]);
  const prefix = "ttsc-spawn-";
  if (recordParent !== undefined) {
    try {
      return openCapture(createCanonicalTempDirectory(prefix, recordParent));
    } catch (error) {
      if (!SourceBuildCacheLayout.refusesDefaultPath(error)) throw error;
    }
  }
  return openCapture(
    createProjectTempDirectory(
      prefix,
      projectRoot ?? undefined,
      additionalProjectRoots,
    ),
  );
}

/** Open the output files and take responsibility for the acquired directory. */
function openCapture(directory: string): CapturedProcessOutput {
  const stdoutPath = path.join(directory, "stdout");
  const stderrPath = path.join(directory, "stderr");
  let stdoutFd: number;
  try {
    stdoutFd = fs.openSync(stdoutPath, "w+");
  } catch (error) {
    removeQuietly(directory);
    throw error;
  }
  let stderrFd: number;
  try {
    stderrFd = fs.openSync(stderrPath, "w+");
  } catch (error) {
    // The first descriptor and the directory are already live. Nothing else
    // will receive a disposer, so cleanup is attempted here rather than left for a
    // caller that never received a handle to dispose.
    closeQuietly(stdoutFd);
    removeQuietly(directory);
    throw error;
  }
  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      closeQuietly(stdoutFd);
      closeQuietly(stderrFd);
      removeQuietly(directory);
    },
    read(stream, encoding): string | Buffer {
      const location = stream === "stdout" ? stdoutPath : stderrPath;
      const raw = fs.readFileSync(location);
      return encoding === "buffer" ? raw : raw.toString(encoding ?? "utf8");
    },
    stderrFd,
    stderrPath,
    stdoutFd,
    stdoutPath,
  };
}

/** Attempt closure without replacing the acquisition or process outcome. */
function closeQuietly(fd: number): void {
  try {
    fs.closeSync(fd);
  } catch {
    // Cleanup remains best effort, including descriptors closed by the host.
  }
}

/**
 * Remove the capture directory without letting cleanup replace a result.
 *
 * `dispose` runs from a `finally`, so a throw here would surface instead of the
 * spawn's own outcome — and on Windows a grandchild that inherited the handle
 * can hold the file long enough to make removal fail. Leaving bytes in the
 * system temp directory is the lesser outcome by far.
 */
function removeQuietly(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort.
  }
}
