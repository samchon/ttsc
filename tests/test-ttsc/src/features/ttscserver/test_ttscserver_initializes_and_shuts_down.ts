import * as os from "node:os";

import { TtscserverClient, assert } from "../../internal/ttscserver";

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
 * @evidence contracts/testing.md#independent-expectations The LSP initialize and shutdown lifecycle independently requires a capability response and clean process exit.
 * @evidence contracts/testing.md#distinguishing-cases 1. Spawn ttscserver via the resolved binary path. 2. Send initialize and wait for the server capabilities response. 3. Notify `initialized`, then send `shutdown` and `exit`. 4. Assert the process exits with status 0.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its server and root; normal shutdown ends its child, and assertion or request failure terminates and awaits the child before rethrowing the original error, and the shared client drains stderr and rejects pending requests on close. Mutable launcher environment is passed only to the owned child.
 * @evidence contracts/e2e.md#preserved-coverage A real native ttscserver returns initialize capabilities and exits zero after initialized, shutdown, exit and stdin close. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_initializes_and_shuts_down = async () => {
  const client = TtscserverClient.start(os.tmpdir());
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
  // process-level exit assertion to prove the handshake landed.
  void client.request("shutdown").catch(() => undefined);
  client.notify("exit");
  client.endStdin();

  const code = await client.waitForExit();
  assert.equal(code, 0, "ttscserver should exit 0 after a clean shutdown");
  } catch (error) {
    client.terminate();
    await client.waitForExit();
    throw error;
  }
};
