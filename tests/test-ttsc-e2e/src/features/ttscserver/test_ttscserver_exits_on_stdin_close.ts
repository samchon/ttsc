import * as os from "node:os";

import { TtscserverClient, assert } from "../../internal/ttscserver";

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
 * @evidence contracts/testing.md#independent-expectations Editor transport EOF requires upstream drainage even when no protocol shutdown arrives; the actual child exit code is the oracle.
 * @evidence contracts/testing.md#distinguishing-cases 1. Spawn ttscserver. 2. Close stdin immediately (no initialize, no shutdown). 3. Assert exit code 0.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its server and root; existing shutdown, EOF or terminate paths end its child, and the shared client drains stderr and rejects pending requests on close. Mutable launcher environment is passed only to the owned child.
 * @evidence contracts/e2e.md#preserved-coverage A real ttscserver exits zero after immediate stdin EOF without initialize or shutdown messages. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
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
