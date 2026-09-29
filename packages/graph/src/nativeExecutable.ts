import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Ensure a resolved native binary can be executed on POSIX installs.
 *
 * Some package managers or non-POSIX pack hosts can materialize platform
 * package binaries without executable bits. The ttsc launcher already repairs
 * its native helper before spawning; @ttsc/graph has its own ttscgraph spawn
 * paths, so it must apply the same first-run repair here.
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

export interface CapturedProcessOutput {
  /** Close the descriptors and remove the backing files. */
  dispose(): void;

  /** Read one stream's text. */
  read(stream: "stdout" | "stderr"): string;
  stderrFd: number;
  stdoutFd: number;
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
 */
export function captureProcessOutput(): CapturedProcessOutput {
  const directory = createCanonicalTempDirectory("ttscgraph-spawn-");
  const stdoutPath = path.join(directory, "stdout");
  const stderrPath = path.join(directory, "stderr");
  const stdoutFd = fs.openSync(stdoutPath, "w+");
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
  return {
    dispose(): void {
      closeQuietly(stdoutFd);
      closeQuietly(stderrFd);
      removeQuietly(directory);
    },
    read(stream): string {
      const location = stream === "stdout" ? stdoutPath : stderrPath;
      try {
        return fs.readFileSync(location, "utf8");
      } catch {
        // A spawn that never launched leaves nothing behind.
        return "";
      }
    },
    stderrFd,
    stdoutFd,
  };
}

/** Create capture storage beneath the frozen physical system-temp parent. */
function createCanonicalTempDirectory(prefix: string): string {
  const physicalParent = fs.realpathSync.native(os.tmpdir());
  if (!fs.lstatSync(physicalParent).isDirectory()) {
    throw new Error(
      `@ttsc/graph: temporary directory parent is not a directory: ${physicalParent}`,
    );
  }
  const directory = fs.mkdtempSync(path.join(physicalParent, prefix));
  if (!fs.lstatSync(directory).isDirectory()) {
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
