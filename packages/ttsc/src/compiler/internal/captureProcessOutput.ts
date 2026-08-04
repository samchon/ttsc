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
 * `spawnSync` holds a *piped* stream in this process's memory and refuses to
 * keep more than `maxBuffer` bytes, so any piped capture has to name a ceiling
 * — and a ceiling is a number nobody chose for this machine, deciding on the
 * user's behalf that a large but legitimate build said too much. Handing the
 * child a file descriptor instead means the bytes never pass through this heap
 * at all, so there is nothing to bound: how much a process may write is the
 * filesystem's business, and it is the same answer on every machine.
 *
 * The directory is per-call, so two concurrent spawns cannot read each other's
 * bytes.
 */
export function captureProcessOutput(): CapturedProcessOutput {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-spawn-"));
  const stdoutPath = path.join(directory, "stdout");
  const stderrPath = path.join(directory, "stderr");
  const stdoutFd = fs.openSync(stdoutPath, "w+");
  const stderrFd = fs.openSync(stderrPath, "w+");
  return {
    dispose(): void {
      for (const fd of [stdoutFd, stderrFd]) {
        try {
          fs.closeSync(fd);
        } catch {
          // Already closed. Removing the directory below is what reclaims the
          // space either way.
        }
      }
      fs.rmSync(directory, { force: true, recursive: true });
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
