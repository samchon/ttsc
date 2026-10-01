import { TestProject } from "@ttsc/testing";

import {
  assert,
  createFakeGoBinary,
  createSourcePluginWorkerScript,
  fs,
  path,
  spawnSourcePluginWorker,
  waitForCondition,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies buildSourcePlugin waiter recovers when the holder fails and
 * releases.
 *
 * End-to-end pin for issue #421: a holder whose `go build` throws releases the
 * generation in its `finally`, and the waiting process then observes no
 * `current` generation. The old inspector classified that release as an
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
 *
 * @evidence contracts/testing.md#behavioral-verification A failed holder must exit 1 with its build error; the waiter must acquire after release, perform its own build and publish the literal stub binary without abandonment or malformed age diagnostics.
 * @evidence contracts/testing.md#independent-expectations File barriers establish holder build admission and waiter pre-lock probing independently of elapsed timing; explicit nonzero fixture exit and invocation logs define which worker must build.
 * @evidence contracts/testing.md#distinguishing-cases Holder failure/no usable publication, waiter successful recovery, a build invocation and negative abandonment/Infinitym/NaNs diagnostics retain the distinct failure-side handoff contract; the publication-side twin checks reuse.
 * @evidence contracts/testing.md#execution-ownership The exported async entry starts two real Node workers invoking shipped buildSourcePlugin and a scripted Go tool, then asserts both process outcomes and the waiter artifact/log.
 * @evidence contracts/e2e.md#necessary-boundary Separate process liveness and concurrent lock visibility are necessary to distinguish released current from abandonment while a waiter retries; a single-process predicate cannot exercise this handoff.
 * @evidence contracts/e2e.md#shared-execution Holder and waiter share one module, worker script, fake tool and cache key. Their two process lifetimes are required conflicting roles; failed holder work requires one waiter build instead of a reusable publication.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private barrier/log/cache paths distinguish roles and environment hooks remain child-local. Success awaits both children, whose helper timeout bounds a wedged process; every spawned worker is registered immediately and finally releases the holder barrier and joins all registered workers, including early probe/assertion failures.
 * @evidence contracts/e2e.md#preserved-coverage Every original holder status/error, waiter status/bytes, invocation and negative diagnostic assertion remains here; no claim is made that the fake artifact proves contributor compilation or that fixture compilation verifies real Go code.
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

    const workers: Array<ReturnType<typeof spawnSourcePluginWorker>> = [];
    try {
      const holder = spawnSourcePluginWorker({
        env: {
          FAKE_GO_BUILD_BARRIER_FILE: holderBarrier,
          FAKE_GO_BUILD_EXIT_CODE: "1",
          FAKE_GO_BUILD_RELEASE_FILE: holderRelease,
        },
        goBinary: fakeGo,
        script,
      });
      workers.push(holder);
      void holder.catch(() => undefined);
      await waitForCondition(
        () => fs.existsSync(holderBarrier),
        "the holder to enter its go build while owning the lock",
      );

      const waiter = spawnSourcePluginWorker({
        env: { FAKE_GO_INVOCATION_LOG: waiterLog },
        goBinary: fakeGo,
        script,
      });
      workers.push(waiter);
      void waiter.catch(() => undefined);
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
    } finally {
      const releaseErrors: unknown[] = [];
      for (const releaseFile of [holderRelease]) {
        try {
          fs.writeFileSync(releaseFile, "release\n", "utf8");
        } catch (error) {
          releaseErrors.push(error);
        }
      }
      await Promise.allSettled(workers);
      if (releaseErrors.length !== 0) {
        throw new AggregateError(releaseErrors, "worker release barriers failed");
      }
    }
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
