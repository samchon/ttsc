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
 * workspace inputs after Go option and linker failures.
 *
 * Native plugins are compiler inputs after their descriptor resolves, not a
 * project-directory convention. Their source edit must rebuild the running
 * session so the content-addressed plugin binary is selected again.
 *
 * 1. Start the source-plugin fixture with an unknown Go option in external GOENV.
 *    Verify the first build fails and the session stays quiet.
 * 2. Replace the option with a bad linker flag in GOENV. Verify the next build
 *    fails during linking and the session stays quiet again.
 * 3. Clear GOENV and check that the session emits PLUGIN.
 * 4. Change the selected plugin from uppercasing to lowercasing and check the same
 *    session emits plugin.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs a real Go source-plugin WatchSession with an initial Go option failure, changes only GOENV to reach a linker failure, then clears GOENV to emit PLUGIN and changes ToUpper to ToLower to emit plugin.
 * @evidence contracts/testing.md#independent-expectations Uppercasing the authored plugin literal yields PLUGIN while lowercasing yields plugin. These literal expectations and removal of the fixture's goUpper call distinguish the changed native binary from stale output or untransformed source; explicit complete banners reject failed-build counts.
 * @evidence contracts/testing.md#distinguishing-cases The Go option fails before package admission and the linker option fails during the subsequent Go build. Both stable failures stay quiet without prior successful publication. External-only changes resume the native build, and a main-package semantic edit verifies ordinary source watches.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source is discovered under src/features/native-plugins/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor resolution must feed native source subscription and actual watch rebuild. Direct source hashes do not establish that host/process connection.
 * @evidence contracts/e2e.md#shared-execution One watch session and private cache cover both failure phases, external repair and the existing selected source change. The repaired build supplies the uppercase result needed by the existing lowercase case.
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
    fs.writeFileSync(goenv, "GOFLAGS=-ttsc-invalid-go-option\n");
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
      assert.match(
        session.transcript(),
        /reading go\.mod for plugin "go-source-plugin" failed/,
      );
      assert.match(session.transcript(), /ttsc-invalid-go-option/);
      assert.match(session.transcript(), /\[ttsc\] watch build failed/);
      await session.waitForQuiet();
      const firstFailure = session.transcript().length;
      fs.writeFileSync(goenv, "GOFLAGS=-ldflags=-ttsc-invalid-linker-option\n");
      await waitForBuild(2);
      const linkerFailure = session.transcript().slice(firstFailure);
      assert.match(linkerFailure, /via "go build" failed/);
      assert.match(linkerFailure, /ttsc-invalid-linker-option/);
      assert.match(linkerFailure, /\[ttsc\] watch build failed/);
      await session.waitForQuiet();
      const secondFailure = session.transcript().length;
      fs.writeFileSync(goenv, "");
      await waitForBuild(3);
      assert.match(
        session.transcript().slice(secondFailure),
        /\[ttsc\] watch build complete/,
      );
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
      await waitForBuild(4);
      assert.equal(
        (session.transcript().match(/\[ttsc\] watch build complete/g) ?? [])
          .length,
        2,
        session.transcript(),
      );
      assert.equal(
        (session.transcript().match(/\[ttsc\] watch build failed/g) ?? [])
          .length,
        2,
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
