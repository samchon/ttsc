import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CapturedProcessOutput } from "./CapturedProcessOutput";

/**
 * Ensure a resolved native binary can be executed on POSIX installs.
 *
 * Some package managers or non-POSIX pack hosts can materialize platform
 * package binaries without executable bits. The ttsc launcher already repairs
 * its native helper before spawning; @ttsc/graph has its own ttscgraph spawn
 * paths, so it must apply the same first-run repair here.
 *
 * @evidence contracts/common.md#principled-implementation POSIX executable access is checked before preserving existing permission bits and adding the required execution permissions.
 * @evidence contracts/common.md#clear-and-simple-design This helper owns the native permission boundary for all graph spawn lanes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission repair addresses supported package installation differences; failures still reach the original spawn path.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the package-manager condition and why graph must apply its own spawn-boundary repair.
 * @evidence contracts/performance.md#efficient-algorithms Permission repair uses constant-count access/stat/chmod operations without reading binary contents or scanning directories.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Permission is an effectful spawn precondition, not a completed producer result shared across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This precondition retains no handle, task or historical entry after synchronous filesystem calls.
 * @evidence contracts/portability.md#os-neutral-implementation Windows has no POSIX executable-bit requirement; other hosts use filesystem access and mode APIs rather than path spelling assumptions.
 */
export function ensureExecutable(binary: string): void {
  if (process.platform === "win32") return;
  try {
    fs.accessSync(binary, fs.constants.X_OK);
    return;
  } catch {
    try {
      const mode = fs.statSync(binary).mode & 0o777;
      fs.chmodSync(binary, mode | 0o755);
    } catch {
      /* keep the original spawn error path */
    }
  }
}

/**
 * A pair of temporary files standing in for a child process's pipes.
 *
 * `spawnSync` holds a _piped_ stream in this process's memory and refuses to
 * keep more than `maxBuffer` bytes, so any piped capture has to name a ceiling
 * — and a ceiling is a number nobody chose for this machine, deciding that a
 * large but legitimate graph said too much. Handing the child a file descriptor
 * instead means the bytes never pass through this heap on their way out of the
 * child: how much a process may write is the filesystem's business, and that is
 * the same answer everywhere. Reading the result back still materializes a
 * string, so V8's own maximum string length remains the outer bound — a
 * property of the runtime rather than a budget chosen here.
 *
 * @evidence contracts/common.md#principled-implementation Passing file descriptors avoids spawnSync's pipe-buffer limit while later UTF-8 reads preserve each output channel.
 * @evidence contracts/common.md#clear-and-simple-design One factory transfers descriptor and directory ownership through a read/dispose handle; private helpers isolate cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The capture uses supported spawn descriptors rather than patching child_process or imposing repository-sized output limits.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain file capture, heap materialization and the runtime string-length boundary; the handle documents caller disposal.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs descriptors and path.join operate on every host; storage is created beneath the resolved physical system-temp directory.
 * @evidence contracts/performance.md#efficient-algorithms Capturing writes directly to files; reading costs linear output bytes and materializes one stream string, with no pipe-buffer copy in this heap.
 * @evidence contracts/performance.md#reuse-equivalent-work Stdout and stderr are distinct effectful streams from one child invocation; reruns require new storage and cannot reuse a prior result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned owner disposes two descriptors and one directory; acquisition failure unwinds acquired storage and removal is best effort when foreign handles remain open.
 */
export function captureProcessOutput(): CapturedProcessOutput {
  const directory = createCanonicalTempDirectory("ttscgraph-spawn-");
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
    // The first descriptor and the directory are already live, and no caller
    // ever received a handle to dispose of them.
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
    read(stream): string {
      const location = stream === "stdout" ? stdoutPath : stderrPath;
      return fs.readFileSync(location, "utf8");
    },
    stderrFd,
    stdoutFd,
  };
}

/** Create capture storage beneath the frozen physical system-temp parent. */
function createCanonicalTempDirectory(prefix: string): string {
  const physicalParent = fs.realpathSync.native(os.tmpdir());
  const parentIdentity = fs.lstatSync(physicalParent);
  if (!parentIdentity.isDirectory()) {
    throw new Error(
      `@ttsc/graph: temporary directory parent is not a directory: ${physicalParent}`,
    );
  }
  const directory = fs.mkdtempSync(path.join(physicalParent, prefix));
  let childIdentity: fs.Stats | undefined;
  try {
    childIdentity = fs.lstatSync(directory);
    if (!childIdentity.isDirectory() || childIdentity.isSymbolicLink()) {
      throw new Error(
        `@ttsc/graph: temporary directory postflight is not a directory: ${directory}`,
      );
    }
    const physicalDirectory = fs.realpathSync.native(directory);
    if (path.dirname(physicalDirectory) !== physicalParent) {
      throw new Error(
        `@ttsc/graph: temporary directory escaped its physical parent: ${physicalDirectory}`,
      );
    }
    return physicalDirectory;
  } catch (error) {
    removeUnchangedTempDirectory(
      directory,
      physicalParent,
      prefix,
      parentIdentity,
      childIdentity,
    );
    throw error;
  }
}

/** Roll back only an unchanged direct child whose native ownership was seen. */
function removeUnchangedTempDirectory(
  directory: string,
  parent: string,
  prefix: string,
  parentIdentity: fs.Stats,
  childIdentity: fs.Stats | undefined,
): void {
  if (
    childIdentity === undefined ||
    !childIdentity.isDirectory() ||
    childIdentity.isSymbolicLink() ||
    path.dirname(directory) !== parent ||
    !path.basename(directory).startsWith(prefix)
  )
    return;
  try {
    const currentParent = fs.lstatSync(parent);
    const currentChild = fs.lstatSync(directory);
    if (
      fs.realpathSync.native(parent) !== parent ||
      !currentParent.isDirectory() ||
      currentParent.isSymbolicLink() ||
      currentParent.dev !== parentIdentity.dev ||
      currentParent.ino !== parentIdentity.ino ||
      !currentChild.isDirectory() ||
      currentChild.isSymbolicLink() ||
      currentChild.dev !== childIdentity.dev ||
      currentChild.ino !== childIdentity.ino
    )
      return;
    removeQuietly(directory);
  } catch {
    // Failed ownership checks leave storage untouched rather than delete a
    // replacement or an unrelated canonical target.
  }
}

/** Close a descriptor, ignoring one that is already closed. */
function closeQuietly(fd: number): void {
  try {
    fs.closeSync(fd);
  } catch {
    // Already closed; removing the directory is what reclaims the space.
  }
}

/**
 * Remove the capture directory without letting cleanup replace a result.
 *
 * `dispose` runs from a `finally`, so a throw here would surface instead of the
 * spawn's own outcome — and on Windows a grandchild that inherited the handle
 * can hold the file long enough to make removal fail.
 */
function removeQuietly(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort.
  }
}
