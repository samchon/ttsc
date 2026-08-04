import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CapturedProcessOutput {
  /** Close the descriptors and remove the backing files. */
  dispose(): void;
  /** Read one stream's bytes, decoded unless `"buffer"` is asked for. */
  read(
    stream: "stdout" | "stderr",
    encoding: BufferEncoding | "buffer" | undefined,
  ): string | Buffer;
  stderrFd: number;
  stdoutFd: number;
}

/**
 * A pair of temporary files standing in for a child process's pipes.
 *
 * `spawnSync` holds a _piped_ stream in this process's memory and refuses to
 * keep more than `maxBuffer` bytes, so any piped capture has to name a ceiling
 * — and a ceiling is a number nobody chose for this machine, deciding on the
 * user's behalf that a large but legitimate build said too much. Handing the
 * child a file descriptor instead means the bytes never pass through this heap
 * on their way out of the child: how much a process may write is the
 * filesystem's business, and that is the same answer on every machine. Reading
 * the result back still materializes a string, so V8's own maximum string
 * length remains the outer bound — but that is a property of the runtime rather
 * than a budget chosen here, and it is identical everywhere this runs.
 *
 * The directory is per-call, so two concurrent spawns cannot read each other's
 * bytes.
 */
export function captureProcessOutput(): CapturedProcessOutput {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-spawn-"));
  const stdoutPath = path.join(directory, "stdout");
  const stderrPath = path.join(directory, "stderr");
  const stdoutFd = fs.openSync(stdoutPath, "w+");
  let stderrFd: number;
  try {
    stderrFd = fs.openSync(stderrPath, "w+");
  } catch (error) {
    // The first descriptor and the directory are already live. Nothing else
    // will ever hold them, so they are released here rather than left for a
    // caller that never received a handle to dispose.
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
    read(stream, encoding): string | Buffer {
      const location = stream === "stdout" ? stdoutPath : stderrPath;
      let raw: Buffer;
      try {
        raw = fs.readFileSync(location);
      } catch {
        // A spawn that never launched leaves nothing behind. Report the same
        // empty output a failed piped capture would have.
        raw = Buffer.alloc(0);
      }
      return encoding === "buffer" ? raw : raw.toString(encoding ?? "utf8");
    },
    stderrFd,
    stdoutFd,
  };
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
