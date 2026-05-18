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
 */
export const test_ttscserver_initializes_and_shuts_down = async () => {
  const client = TtscserverClient.start(os.tmpdir());
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
};
