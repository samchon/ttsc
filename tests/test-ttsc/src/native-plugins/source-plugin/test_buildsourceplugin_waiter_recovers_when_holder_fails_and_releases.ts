import { TestProject } from "@ttsc/testing";

import {
  assert,
  createFakeGoBinary,
  createSourcePluginWorkerScript,
  fs,
  path,
  spawnSourcePluginWorker,
  waitForCondition,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin waiter recovers when the holder fails and
 * releases.
 *
 * End-to-end pin for issue #421: a holder whose `go build` throws releases the
 * lock in its `finally`, and the waiting process then observes a lock that no
 * longer exists. The old inspector classified that released lock as an
 * infinitely old abandoned legacy lock and printed `reclaiming abandoned ...
 * Infinitym NaNs old`. The waiter must instead treat the free key as a routine
 * handoff: reacquire it, run the build itself, and publish the one usable
 * binary. Sequencing uses explicit file barriers produced by the fake
 * toolchain, never sleeps — every interleaving must satisfy the assertions.
 *
 * 1. Start a holder worker whose fake `go build` writes a barrier file, then
 *    blocks until released, then exits non-zero.
 * 2. After the barrier exists, start a waiter worker on the same cache key and
 *    release the holder once the waiter's fake-go invocation log shows it
 *    passed its pre-lock toolchain probes.
 * 3. Assert the holder exits 1 without publishing while the waiter exits 0, runs
 *    its own `go build`, and publishes the binary.
 * 4. Assert the waiter's stderr never reports reclaiming an abandoned lock and
 *    never contains the `Infinitym NaNs` malformation.
 */
export const test_buildsourceplugin_waiter_recovers_when_holder_fails_and_releases =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-handoff-");
    const plugin = path.join(root, "plugin");
    writePluginSource(plugin);
    const fakeGo = createFakeGoBinary(root);
    const script = createSourcePluginWorkerScript({
      cacheDir: path.join(root, "cache"),
      pluginName: "lock-release-race",
      root,
      source: plugin,
    });

    const holderBarrier = path.join(root, "holder-building.txt");
    const holderRelease = path.join(root, "holder-release.txt");
    const waiterLog = path.join(root, "waiter-go.log");

    const holder = spawnSourcePluginWorker({
      env: {
        FAKE_GO_BUILD_BARRIER_FILE: holderBarrier,
        FAKE_GO_BUILD_EXIT_CODE: "1",
        FAKE_GO_BUILD_RELEASE_FILE: holderRelease,
      },
      goBinary: fakeGo,
      script,
    });
    await waitForCondition(
      () => fs.existsSync(holderBarrier),
      "the holder to enter its go build while owning the lock",
    );

    const waiter = spawnSourcePluginWorker({
      env: { FAKE_GO_INVOCATION_LOG: waiterLog },
      goBinary: fakeGo,
      script,
    });
    await waitForCondition(
      () =>
        fs.existsSync(waiterLog) &&
        fs.readFileSync(waiterLog, "utf8").includes("env -json"),
      "the waiter to finish its pre-lock toolchain probes",
    );
    fs.writeFileSync(holderRelease, "release\n", "utf8");

    const [holderResult, waiterResult] = await Promise.all([holder, waiter]);

    assert.equal(holderResult.status, 1, holderResult.stderr);
    assert.match(holderResult.stderr, /go build" failed/);
    assert.equal(waiterResult.status, 0, waiterResult.stderr);
    const binary = waiterResult.stdout.trim();
    assert.equal(fs.readFileSync(binary, "utf8"), "fake plugin binary\n");
    assert.match(waiterResult.stderr, /building source plugin/);
    assert.match(fs.readFileSync(waiterLog, "utf8"), /^build /m);
    assert.doesNotMatch(waiterResult.stderr, /reclaiming abandoned/);
    assert.doesNotMatch(waiterResult.stderr, /Infinitym|NaNs/);
  };

function writePluginSource(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "package main\n", "utf8");
  }
}
