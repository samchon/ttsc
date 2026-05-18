import * as os from "node:os";

import { TtscserverClient, assert } from "../../internal/ttscserver";

/**
 * Verifies ttscserver exits cleanly when the editor closes its stdin without
 * sending a proper shutdown sequence.
 *
 * Editors crash or get killed; the LSP host must not deadlock waiting for
 * shutdown notifications that will never arrive. This pins the
 * internal/lspserver proxy fallback that closes the upstream pipe on editor EOF,
 * which in turn lets the upstream tsgo process drain.
 *
 * 1. Spawn ttscserver.
 * 2. Close stdin immediately (no initialize, no shutdown).
 * 3. Assert exit code 0.
 */
export const test_ttscserver_exits_on_stdin_close = async () => {
  const client = TtscserverClient.start(os.tmpdir());
  client.forceClose();
  const code = await client.waitForExit();
  assert.equal(
    code,
    0,
    "ttscserver should exit 0 even without a shutdown handshake",
  );
};
