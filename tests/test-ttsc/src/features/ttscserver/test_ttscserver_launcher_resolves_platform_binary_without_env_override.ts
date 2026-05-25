import { TestProject } from "@ttsc/testing";

import {
  TtscserverClient,
  initializeTtscserverClient,
  shutdownTtscserverClient,
} from "../../internal/ttscserver";

/**
 * Verifies ttscserver launcher resolves the platform binary without env
 * override.
 *
 * Most plugin-aware e2e tests pin `TTSCSERVER_BINARY` so they use the current
 * workspace build. The JavaScript launcher must also work in the installed
 * package shape where no override is present and it resolves the platform
 * package itself.
 *
 * 1. Create an empty workspace root.
 * 2. Start `lib/launcher/ttscserver.js` without `TTSCSERVER_BINARY`.
 * 3. Run initialize and shutdown through stdio.
 * 4. Assert the server exits cleanly.
 */
export const test_ttscserver_launcher_resolves_platform_binary_without_env_override =
  async () => {
    const cwd = TestProject.tmpdir("ttscserver-launcher-resolve-");
    const client = TtscserverClient.startLauncher(cwd, {
      injectTtscserverBinary: false,
    });
    try {
      await initializeTtscserverClient(client, cwd);
    } finally {
      await shutdownTtscserverClient(client);
    }
  };
