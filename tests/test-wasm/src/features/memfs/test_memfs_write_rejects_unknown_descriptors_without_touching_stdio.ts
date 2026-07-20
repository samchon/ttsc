import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, openFd, writeFdText } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;

/**
 * Verifies a MemFS write through an unknown or closed descriptor fails with
 * `EBADF` instead of being diverted into the captured stderr.
 *
 * The unknown-fd branch appended the bytes to `stderr.buffer`, logged a console
 * error, and returned the full byte count, so the caller continued on a success
 * that never happened while a diagnostic channel consumers read silently gained
 * content it did not produce. That is much broader than the deliberate fd 1 /
 * fd 2 routing, which must keep working.
 *
 * 1. Write through a descriptor that was never opened and through one that was
 *    opened and closed.
 * 2. Write through fd 1 and fd 2.
 * 3. Assert the bad descriptors return `EBADF` with zero bytes and leave both
 *    capture buffers untouched, while fd 1 and fd 2 still capture.
 */
export const test_memfs_write_rejects_unknown_descriptors_without_touching_stdio =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abc");
    const closed = await openFd(host.fs, "/f.txt", O_WRONLY);
    await callMutation((cb) => host.fs.close(closed, cb));

    TestValidator.equals(
      "bad descriptors write nothing",
      {
        unknown: await writeFdText(host.fs, 999, "BAD", null),
        closed: await writeFdText(host.fs, closed, "BAD", null),
        stdout: host.stdout.buffer,
        stderr: host.stderr.buffer,
        file: host.readFileText("/f.txt"),
      },
      {
        unknown: { code: "EBADF", n: 0 },
        closed: { code: "EBADF", n: 0 },
        stdout: "",
        stderr: "",
        file: "abc",
      },
    );

    // writeSync is the synchronous entry wasm_exec.js calls; it throws rather
    // than reporting a byte count it did not write.
    let syncCode: string | null = null;
    try {
      host.fs.writeSync(999, new TextEncoder().encode("BAD"));
    } catch (err) {
      syncCode = (err as { code?: string }).code ?? "UNKNOWN";
    }
    TestValidator.equals("writeSync throws EBADF", syncCode, "EBADF");

    // Positive twin: the reserved stdio descriptors are unchanged.
    await writeFdText(host.fs, 1, "OUT", null);
    await writeFdText(host.fs, 2, "ERR", null);
    host.fs.writeSync(1, new TextEncoder().encode("SYNC"));
    TestValidator.equals(
      "fd 1 and fd 2 still capture",
      { stdout: host.stdout.buffer, stderr: host.stderr.buffer },
      { stdout: "OUTSYNC", stderr: "ERR" },
    );
  };
