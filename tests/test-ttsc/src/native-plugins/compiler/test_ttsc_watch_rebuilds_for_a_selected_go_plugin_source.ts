import { TestProject } from "@ttsc/testing";

import { goPath } from "../../internal/plugin-corpus";
import { fs, path, workspaceRoot } from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies `ttsc --watch` follows the selected Go plugin source tree.
 *
 * Native plugins are compiler inputs after their descriptor resolves, not a
 * project-directory convention. Their source edit must rebuild the running
 * session so the content-addressed plugin binary is selected again.
 *
 * 1. Copy the real source-plugin fixture and wait for the initial watch build.
 * 2. Edit the selected plugin's Go implementation.
 * 3. Require one more real watch build without restarting the process.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs a real Go source-plugin WatchSession, appends a comment to selected main.go after initial build and requires a second completion without restarting.
 * @evidence contracts/testing.md#independent-expectations The descriptor-selected plugin source tree is a compile input. Authored changed Go bytes establish expected invalidation independently of the watcher calculated paths.
 * @evidence contracts/testing.md#distinguishing-cases Owns a main-package edit in a live native host. Comment-only change proves scheduling rather than changed transform meaning; literal changed output, sibling module/go.mod and ignored paths belong to the module entry.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source is discovered under src/native-plugins/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor resolution must feed native source subscription and actual watch rebuild. Direct source hashes do not establish that host/process connection.
 * @evidence contracts/e2e.md#shared-execution One watch session/private cache batches initial producer and changed-source producer. Built compiler/Go object caches are shared while changed source identity requires a fresh plugin artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique roots/cache and child-only PATH/cache overrides separate warm artifacts. finally closes WatchSession and TestProject removes paths at worker exit after descendant handle release.
 * @evidence contracts/e2e.md#preserved-coverage Both build waits and selected source edit remain at src/native-plugins/compiler. Exact cycle count and fresh transformed content are not inferred from completion banners, and native compiler lane execution is required.
 */
export const test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source =
  async (): Promise<void> => {
    // Removed when the suite exits: ending the session ends its descendants,
    // which on Windows go a moment later and hold the directory until then.
    const root = TestProject.tmpdir("ttsc-watch-");
    const cache = TestProject.tmpdir("ttsc-watch-cache-");
    fs.cpSync(
      path.join(workspaceRoot, "tests", "projects", "go-source-plugin"),
      root,
      { recursive: true },
    );
    const source = path.join(root, "go-plugin", "main.go");
    const localGo = goPath();
    const session = new WatchSession(root, {
      env: {
        ...(localGo === undefined ? {} : { PATH: localGo }),
        TTSC_CACHE_DIR: cache,
      },
    });
    try {
      await session.waitForBuilds(1);
      fs.appendFileSync(source, "\n// watch topology regression\n", "utf8");
      await session.waitForBuilds(2);
    } finally {
      await session.close();
    }
  };
