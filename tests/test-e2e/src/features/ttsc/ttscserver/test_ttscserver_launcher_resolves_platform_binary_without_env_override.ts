import { TestProject } from "@ttsc/testing";

import {
  TtscserverClient,
  initializeTtscserverClient,
  runTtscserverSession,
} from "../../../internal/ttsc/internal/ttscserver";

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
 *
 * @evidence contracts/testing.md#behavioral-verification The JavaScript launcher without TTSCSERVER_BINARY completes initialize and clean shutdown using package resolution.
 * @evidence contracts/testing.md#independent-expectations The supported launcher default resolves its platform package; actual stdio capabilities and zero process exit independently prove the resulting host runs.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create an empty workspace root. 2. Start `lib/launcher/ttscserver.js` without `TTSCSERVER_BINARY`. 3. Run initialize and shutdown through stdio. 4. Assert the server exits cleanly.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its server and root; existing shutdown, EOF or terminate paths end its child, and the shared client drains stderr and rejects pending requests on close. Mutable launcher environment is passed only to the owned child.
 * @evidence contracts/e2e.md#preserved-coverage The JavaScript launcher without TTSCSERVER_BINARY completes initialize and clean shutdown using package resolution. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_launcher_resolves_platform_binary_without_env_override =
  async () => {
    const cwd = TestProject.tmpdir("ttscserver-launcher-resolve-");
    const client = TtscserverClient.startLauncher(cwd, {
      injectTtscserverBinary: false,
    });
    await runTtscserverSession(client, async () => {
      await initializeTtscserverClient(client, cwd);
    });
  };
