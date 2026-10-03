import * as os from "node:os";

import { TtscserverClient, assert } from "../../../internal/ttsc/internal/ttscserver";

/**
 * Verifies ttscserver completes a full LSP initialize → shutdown → exit cycle.
 *
 * Resolves the native binary the same way the JS launcher would (the helper
 * uses `resolveTtscserverBinary` directly) and drives stdio against the
 * resulting process. Dedicated launcher tests cover argument/env wrapping; this
 * case pins the proxy + upstream tsgo LSP initialize / shutdown handshake and
 * the clean-exit contract editors rely on.
 *
 * 1. Spawn ttscserver via the resolved binary path.
 * 2. Send initialize and wait for the server capabilities response.
 * 3. Notify `initialized`, then send `shutdown` and `exit`.
 * 4. Assert the process exits with status 0.
 *
 * @evidence contracts/testing.md#behavioral-verification A real native ttscserver returns initialize capabilities and exits zero after initialized, shutdown, exit and stdin close.
 * @evidence contracts/testing.md#independent-expectations Initialize body and capabilities are required to be truthy, followed by literal code0 after exit/stdin close. Shutdown is intentionally unawaited with a rejection observer; this is not a matched shutdown-response or detailed capability-shape oracle.
 * @evidence contracts/testing.md#distinguishing-cases This initialized profile differs from immediate EOF and awaited shutdown with editor stdin open: it observes initialize first, sends shutdown without waiting, sends exit and ends stdin. Those distinctions and the original code0/body/capabilities assertions remain.
 * @evidence contracts/testing.md#execution-ownership The named features/ttsc/ttscserver entry uses native TtscserverClient.start through TestExecutor. Its actual resolver/constructor is distinct from startLauncher; no JavaScript-launcher forwarding or independent shutdown-response assertion is claimed.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One native server lifetime uses shared os.tmpdir cwd, not an owned mutable root. The shutdown rejection observer remains installed before exit/stdin close. Direct close must be observed within thirty seconds; failure attempts termination and independently awaits close for ten seconds, retaining original plus cleanup errors and clearing timers. No unresolved child or arbitrary descendants are certified released.
 * @evidence contracts/e2e.md#preserved-coverage A real native ttscserver returns initialize capabilities and exits zero after initialized, shutdown, exit and stdin close. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_initializes_and_shuts_down = async () => {
  const client = TtscserverClient.start(os.tmpdir());
  let timer: NodeJS.Timeout | undefined;
  try {
  const result = (await client.request("initialize", {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
  })) as { capabilities?: unknown };
  assert.ok(result, "initialize returned a body");
  assert.ok(
    result.capabilities,
    "server response should carry capabilities for the editor to consume",
  );

  client.notify("initialized", {});
  // tsgo does not always flush a shutdown response before processing
  // the follow-up exit notification, so we send the shutdown request
  // without awaiting its response and rely on the exit notification +
  // process-level exit assertion. It does not prove a shutdown response arrived.
  void client.request("shutdown").catch(() => undefined);
  client.notify("exit");
  client.endStdin();

  const code = await Promise.race([
    client.waitForExit(),
    new Promise<"running">((resolve) => {
      timer = setTimeout(() => resolve("running"), 30_000);
    }),
  ]);
  assert.equal(code, 0, "ttscserver should exit 0 after a clean shutdown");
  } catch (error) {
    clearTimeout(timer);
    const cleanupFailures: unknown[] = [];
    try {
      client.terminate();
    } catch (cause) {
      cleanupFailures.push(new Error("server termination request failed", { cause }));
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
      throw new AggregateError([error, ...cleanupFailures], "initialized shutdown and cleanup failed");
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
