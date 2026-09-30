import { assertFixtureDerivesMissingCandidate } from "../../internal/adapter-vite-serve/assertFixtureDerivesMissingCandidate";
import { createLinkedWorkspaceFixture } from "../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { requestMainModule } from "../../internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../internal/adapter-vite-serve/startViteServer";

/**
 * Verifies missing resolution candidates survive a dev-server restart.
 *
 * A restart builds a replacement plugin container before the old one closes.
 * The recorded missing candidates must be registered again for the new server
 * without the old container's disposal breaking the replacement.
 *
 * 1. Start a dev server over a fixture whose graph derives a missing candidate.
 * 2. Request the entry module.
 * 3. Restart the server and request the entry module again.
 *
 * @evidence contracts/testing.md#behavioral-verification Entry requests succeed both before and after real server restart over graph-proven missing candidates.
 * @evidence contracts/testing.md#independent-expectations Fixture graph check establishes missing input; request helper independently requires nonempty code.
 * @evidence contracts/testing.md#distinguishing-cases Initial server versus replacement container, with missing candidates unchanged.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_survives_missing_candidates_after_a_server_restart is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Real Vite restart overlaps replacement and old containers around built native adapter.
 * @evidence contracts/e2e.md#shared-execution One server and fixture serve requests and mutations, with replacement only for restart assertions; shared native artifacts do not replace the cold request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Server closes in finally on success/failure; restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: entry requests succeed both before and after real server restart over graph-proven missing candidates. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_survives_missing_candidates_after_a_server_restart(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  await assertFixtureDerivesMissingCandidate(fixture);
  const server = await startViteServer(fixture);
  try {
    await requestMainModule(server);
    await server.restart();
    await requestMainModule(server);
  } finally {
    await server.close();
  }
}
