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
