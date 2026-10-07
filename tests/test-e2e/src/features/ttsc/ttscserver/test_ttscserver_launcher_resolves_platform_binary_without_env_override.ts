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
 * workspace build. This workspace launcher runs its default binary resolver
 * without that override. The supported local-native fallback remains possible;
 * the test does not establish platform-package-only or packed installation
 * provenance.
 *
 * 1. Create an empty workspace root.
 * 2. Start `lib/launcher/ttscserver.js` without `TTSCSERVER_BINARY`.
 * 3. Run initialize and shutdown through stdio.
 * 4. Assert the server exits cleanly.
 *
 * @evidence contracts/testing.md#behavioral-verification The JavaScript launcher without TTSCSERVER_BINARY completes initialize and clean shutdown using package resolution.
 * @evidence contracts/testing.md#independent-expectations The initialize helper awaits a response and the session helper requires code0 after exit/stdin close. This case does not assert response capabilities or independently identify platform-package selection; default resolution may use the supported local-native fallback.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create an empty workspace root. 2. Start `lib/launcher/ttscserver.js` without `TTSCSERVER_BINARY`. 3. Run initialize and shutdown through stdio. 4. Assert the server exits cleanly.
 * @evidence contracts/testing.md#execution-ownership This named features/ttsc/ttscserver entry starts the workspace-built JavaScript launcher through actual TtscserverClient.startLauncher. The false injection option omits the server binary override; default resolution and actual initialize/close are retained, not installed package or platform-only routing certification.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked empty project root is retained before launcher startup; override omission is child-local. The existing session helper preserves a body error with any shutdown error and bounds shutdown separately at thirty seconds. Deadline failure does not cancel or join the losing shutdown, kill the child, or permit input reuse; direct close and code0 remain the success observation, not descendant termination.
 * @evidence contracts/e2e.md#preserved-coverage The JavaScript launcher without TTSCSERVER_BINARY completes initialize and clean shutdown using package resolution. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_launcher_resolves_platform_binary_without_env_override =
  async () => {
    const cwd = TestProject.tmpdir("ttscserver-launcher-resolve-");
    TestProject.retainTemporaryDirectory(cwd);
    const client = TtscserverClient.startLauncher(cwd, {
      injectTtscserverBinary: false,
    });
    await runTtscserverSession(
      client,
      async () => {
        await initializeTtscserverClient(client, cwd);
      },
      30_000,
    );
  };
