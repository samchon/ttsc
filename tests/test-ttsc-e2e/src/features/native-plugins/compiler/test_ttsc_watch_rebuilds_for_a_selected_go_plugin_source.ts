import { TestProject } from "@ttsc/testing";

import { goPath } from "../../../internal/plugin-corpus";
import { assert, fs, path, workspaceRoot } from "../../../internal/toolchain";
import { WatchSession } from "../../../internal/watch";

/**
 * Verifies `ttsc --watch` follows the selected Go plugin source tree.
 *
 * Native plugins are compiler inputs after their descriptor resolves, not a
 * project-directory convention. Their source edit must rebuild the running
 * session so the content-addressed plugin binary is selected again.
 *
 * 1. Copy the real source-plugin fixture and verify the initial successful build emits PLUGIN.
 * 2. Change the selected plugin from uppercasing to lowercasing.
 * 3. Require a second successful build emitting plugin without restarting.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs a real Go source-plugin WatchSession, verifies its first successful build emits PLUGIN, changes ToUpper to ToLower, and requires another successful build emitting plugin with no remaining goUpper call or stale PLUGIN literal.
 * @evidence contracts/testing.md#independent-expectations Uppercasing the authored plugin literal yields PLUGIN while lowercasing yields plugin. These literal expectations and removal of the fixture's goUpper call distinguish the changed native binary from stale output or untransformed source; explicit complete banners reject failed-build counts.
 * @evidence contracts/testing.md#distinguishing-cases Owns a selected main-package semantic edit in one live host, contrasting uppercase and lowercase outputs while preserving the source value and successful compilation. Sibling module/go.mod and ignored paths belong to the module entry.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source is discovered under src/features/native-plugins/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor resolution must feed native source subscription and actual watch rebuild. Direct source hashes do not establish that host/process connection.
 * @evidence contracts/e2e.md#shared-execution One watch session/private cache batches initial producer and changed-source producer. Built compiler/Go object caches are shared while changed source identity requires a fresh plugin artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique roots/cache and child-only PATH/cache overrides separate warm artifacts. finally closes WatchSession and TestProject removes paths at worker exit after descendant handle release.
 * @evidence contracts/e2e.md#preserved-coverage Both build waits and the selected source edit remain at src/features/native-plugins/compiler. Successful-build and changed-output assertions strengthen the former comment-only scheduling oracle; exact cycle count is not asserted and the native compiler lane executes this case.
 */
export const test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source =
  async (): Promise<void> => {
    // Removed when the suite exits: ending the session ends its descendants,
    // which on Windows go a moment later and hold the directory until then.
    const root = TestProject.tmpdir("ttsc-watch-");
    const cache = TestProject.tmpdir("ttsc-watch-cache-");
    fs.cpSync(
      path.join(workspaceRoot, "packages", "ttsc", "test", "go-source-plugin"),
      root,
      { recursive: true },
    );
    const source = path.join(root, "go-plugin", "main.go");
    const output = path.join(root, "dist", "main.js");
    const localGo = goPath();
    const session = new WatchSession(root, {
      env: {
        ...(localGo === undefined ? {} : { PATH: localGo }),
        TTSC_CACHE_DIR: cache,
      },
    });
    try {
      await session.waitForBuilds(1);
      assert.match(session.transcript(), /\[ttsc\] watch build complete/);
      assert.doesNotMatch(session.transcript(), /\[ttsc\] watch build failed/);
      assert.match(fs.readFileSync(output, "utf8"), /"PLUGIN"/);
      const original = fs.readFileSync(source, "utf8");
      const lowercasing = original.replace(
        "value = strings.ToUpper(value)",
        "value = strings.ToLower(value)",
      );
      assert.notEqual(
        lowercasing,
        original,
        "the fixture's uppercase operation moved",
      );
      fs.writeFileSync(source, lowercasing, "utf8");
      await session.waitForBuilds(2);
      assert.ok(
        (session.transcript().match(/\[ttsc\] watch build complete/g)?.length ??
          0) >= 2,
        session.transcript(),
      );
      assert.doesNotMatch(session.transcript(), /\[ttsc\] watch build failed/);
      const lowered = fs.readFileSync(output, "utf8");
      assert.match(lowered, /"plugin"/);
      assert.doesNotMatch(lowered, /"PLUGIN"|goUpper\(/);
    } finally {
      await session.close();
    }
  };
