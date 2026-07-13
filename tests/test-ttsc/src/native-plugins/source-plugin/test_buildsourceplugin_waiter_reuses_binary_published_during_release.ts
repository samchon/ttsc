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
 * Verifies buildSourcePlugin waiter reuses the binary a holder publishes as it
 * releases.
 *
 * Companion pin for issue #421's success-side race: the holder publishes the
 * binary and removes its lock while the waiter is between two observations.
 * Whatever the interleaving — the waiter sees the binary directly, or first
 * sees the released lock and re-checks — it must reuse the published binary,
 * never rebuild it and never report the routine release as reclaiming an
 * abandoned lock.
 *
 * 1. Start a holder worker whose fake `go build` writes a barrier file and blocks;
 *    start a waiter on the same cache key once the barrier exists.
 * 2. Release the holder after the waiter's fake-go invocation log shows it passed
 *    its pre-lock toolchain probes; the holder publishes and exits 0.
 * 3. Assert both workers exit 0 and print the same binary path.
 * 4. Assert the waiter never ran `go build`, never printed the cold-build banner,
 *    and never reported an abandoned lock.
 */
export const test_buildsourceplugin_waiter_reuses_binary_published_during_release =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-publish-");
    const plugin = path.join(root, "plugin");
    writePluginSource(plugin);
    const fakeGo = createFakeGoBinary(root);
    const script = createSourcePluginWorkerScript({
      cacheDir: path.join(root, "cache"),
      pluginName: "lock-publish-race",
      root,
      source: plugin,
    });

    const holderBarrier = path.join(root, "holder-building.txt");
    const holderRelease = path.join(root, "holder-release.txt");
    const waiterLog = path.join(root, "waiter-go.log");

    const holder = spawnSourcePluginWorker({
      env: {
        FAKE_GO_BUILD_BARRIER_FILE: holderBarrier,
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

    assert.equal(holderResult.status, 0, holderResult.stderr);
    assert.equal(waiterResult.status, 0, waiterResult.stderr);
    const holderBinary = holderResult.stdout.trim();
    const waiterBinary = waiterResult.stdout.trim();
    assert.equal(waiterBinary, holderBinary);
    assert.equal(fs.readFileSync(waiterBinary, "utf8"), "fake plugin binary\n");
    assert.doesNotMatch(fs.readFileSync(waiterLog, "utf8"), /^build /m);
    assert.doesNotMatch(waiterResult.stderr, /building source plugin/);
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
