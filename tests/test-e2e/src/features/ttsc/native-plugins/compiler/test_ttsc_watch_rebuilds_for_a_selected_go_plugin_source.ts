import { TestProject } from "@ttsc/testing";
import { setTimeout } from "node:timers/promises";

import { goPath } from "../../../../internal/ttsc/internal/plugin-corpus";
import {
  assert,
  fs,
  path,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/toolchain";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies `ttsc --watch` follows a selected Go plugin and its external
 * workspace inputs, including recovery from an initial build failure.
 *
 * Native plugins are compiler inputs after their descriptor resolves, not a
 * project-directory convention. Their source edit must rebuild the running
 * session so the content-addressed plugin binary is selected again.
 *
 * 1. Start the real source-plugin fixture with a bad linker flag in an external
 *    GOENV file. Verify the first build fails and the session is quiet.
 * 2. Fix only GOENV and check that the session emits PLUGIN.
 * 3. Change the selected plugin from uppercasing to lowercasing and check the same
 *    session emits plugin.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs a real Go source-plugin WatchSession, verifies its first linker failure stays quiet, repairs only the external GOENV to emit PLUGIN, then changes ToUpper to ToLower and requires another successful build emitting plugin.
 * @evidence contracts/testing.md#independent-expectations Uppercasing the authored plugin literal yields PLUGIN while lowercasing yields plugin. These literal expectations and removal of the fixture's goUpper call distinguish the changed native binary from stale output or untransformed source; explicit complete banners reject failed-build counts.
 * @evidence contracts/testing.md#distinguishing-cases The first failure has no prior successful publication. A stable failed state stays quiet, an external-only repair reloads the native plugin, and a subsequent main-package semantic edit keeps ordinary source watches working.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source is discovered under src/features/native-plugins/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor resolution must feed native source subscription and actual watch rebuild. Direct source hashes do not establish that host/process connection.
 * @evidence contracts/e2e.md#shared-execution One watch session and private cache cover failure, external repair and the existing selected source change. The repaired build supplies the uppercase result needed by the existing lowercase case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique roots and child-only PATH, GOENV and cache overrides separate warm artifacts. Finally retains body and shutdown causes; unresolved close retains source, cache and external GOENV roots. The bounded build waits do not substitute for shutdown ownership.
 * @evidence contracts/e2e.md#preserved-coverage The selected source edit and both successful outputs remain in this native compiler lane, following initial failure and external-only recovery.
 */
export const test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source =
  async (): Promise<void> => {
    // Normal cleanup owns these allocations; failed shutdown retains both
    // source inputs and the separately tracked artifact cache.
    const root = TestProject.tmpdir("ttsc-watch-");
    const cache = TestProject.tmpdir("ttsc-watch-cache-");
    const external = TestProject.tmpdir("ttsc-watch-goenv-");
    const goenv = path.join(external, "env");
    fs.writeFileSync(goenv, "GOFLAGS=-ldflags=-ttsc-invalid-linker-option\n");
    fs.cpSync(
      path.join(workspaceRoot, "packages", "ttsc", "test", "go-source-plugin"),
      root,
      { recursive: true },
    );
    const source = path.join(root, "go-plugin", "main.go");
    const output = path.join(root, "dist", "main.js");
    const localGo = goPath();
    const session = new WatchSession(root, {
      ownedInputRoots: [cache, external],
      env: {
        ...(localGo === undefined ? {} : { PATH: localGo }),
        GOENV: goenv,
        GOFLAGS: undefined,
        GOTOOLCHAIN: "local",
        TTSC_CACHE_DIR: cache,
      },
    });
    const waitForBuild = async (count: number): Promise<void> => {
      const deadline = new AbortController();
      try {
        await Promise.race([
          session.waitForBuilds(count),
          setTimeout(120_000, undefined, { signal: deadline.signal }).then(
            () => {
              throw new Error(
                `Build ${count} did not complete:\n${session.transcript()}`,
              );
            },
          ),
        ]);
      } finally {
        deadline.abort();
      }
    };
    const failures: unknown[] = [];
    try {
      await waitForBuild(1);
      assert.match(session.transcript(), /ttsc-invalid-linker-option/);
      assert.match(session.transcript(), /\[ttsc\] watch build failed/);
      await session.waitForQuiet();
      fs.writeFileSync(goenv, "");
      await waitForBuild(2);
      assert.match(session.transcript(), /\[ttsc\] watch build complete/);
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
      await waitForBuild(3);
      assert.ok(
        (session.transcript().match(/\[ttsc\] watch build complete/g)?.length ??
          0) >= 2,
        session.transcript(),
      );
      assert.equal(
        (session.transcript().match(/\[ttsc\] watch build failed/g) ?? [])
          .length,
        1,
        session.transcript(),
      );
      const lowered = fs.readFileSync(output, "utf8");
      assert.match(lowered, /"plugin"/);
      assert.doesNotMatch(lowered, /"PLUGIN"|goUpper\(/);
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        await session.close();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        "Native source watch and shutdown failed",
      );
  };
