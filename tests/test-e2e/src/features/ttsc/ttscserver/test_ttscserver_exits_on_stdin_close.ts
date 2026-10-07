import * as os from "node:os";

import {
  TtscserverClient,
  assert,
} from "../../../internal/ttsc/internal/ttscserver";

/**
 * Verifies ttscserver exits cleanly when the editor closes its stdin without
 * sending a proper shutdown sequence.
 *
 * Editors crash or get killed; the LSP host must not deadlock waiting for
 * shutdown notifications that will never arrive. This pins the
 * internal/lspserver proxy fallback that closes the upstream pipe on editor
 * EOF, which in turn lets the upstream tsgo process drain.
 *
 * 1. Spawn ttscserver.
 * 2. Close stdin immediately (no initialize, no shutdown).
 * 3. Assert exit code 0.
 *
 * @evidence contracts/testing.md#behavioral-verification A real ttscserver exits zero after immediate stdin EOF without initialize or shutdown messages.
 * @evidence contracts/testing.md#independent-expectations The literal zero-code expectation follows the supported immediate-EOF behavior without protocol messages. Actual direct close is observed; this test does not independently inspect an upstream PID or certify all descendant drainage.
 * @evidence contracts/testing.md#distinguishing-cases 1. Spawn ttscserver. 2. Close stdin immediately (no initialize, no shutdown). 3. Assert exit code 0.
 * @evidence contracts/testing.md#execution-ownership This named features/ttsc/ttscserver entry uses the actual TtscserverClient through TestExecutor. forceClose ends editor stdin; it does not kill the server. The original immediate EOF/no-handshake/code0 assertion remains.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One server lifetime uses shared os.tmpdir cwd, not an owned mutable root. Immediate editor EOF precedes actual direct close; a thirty-second close deadline fails rather than certifying exit. On failure termination is attempted and direct close is independently awaited for ten seconds, preserving original plus cleanup failures and clearing timers. An unresolved child or arbitrary descendants are not claimed released.
 * @evidence contracts/e2e.md#preserved-coverage A real ttscserver exits zero after immediate stdin EOF without initialize or shutdown messages. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_exits_on_stdin_close = async () => {
  const client = TtscserverClient.start(os.tmpdir());
  let timer: NodeJS.Timeout | undefined;
  try {
    client.forceClose();
    const code = await Promise.race([
      client.waitForExit(),
      new Promise<"running">((resolve) => {
        timer = setTimeout(() => resolve("running"), 30_000);
      }),
    ]);
    assert.equal(
      code,
      0,
      "ttscserver should exit 0 even without a shutdown handshake",
    );
  } catch (error) {
    clearTimeout(timer);
    const cleanupFailures: unknown[] = [];
    try {
      client.terminate();
    } catch (cause) {
      cleanupFailures.push(
        new Error("server termination request failed", { cause }),
      );
    }
    let closeTimer: NodeJS.Timeout | undefined;
    try {
      const closed = await Promise.race([
        client.waitForExit().then(() => true),
        new Promise<boolean>((resolve) => {
          closeTimer = setTimeout(() => resolve(false), 10_000);
        }),
      ]);
      if (!closed)
        throw new Error("server direct close was not joined after termination");
    } catch (cause) {
      cleanupFailures.push(cause);
    } finally {
      clearTimeout(closeTimer);
    }
    if (cleanupFailures.length !== 0)
      throw new AggregateError(
        [error, ...cleanupFailures],
        "stdin EOF and cleanup failed",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
