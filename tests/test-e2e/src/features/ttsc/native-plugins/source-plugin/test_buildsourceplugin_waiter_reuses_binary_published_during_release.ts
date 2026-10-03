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
 * Verifies buildSourcePlugin waiter reuses the binary a holder publishes as it
 * releases.
 *
 * Companion pin for issue #421's success-side race: the holder publishes the
 * binary and retires its generation while the waiter is between observations.
 * Whatever the interleaving — the waiter sees the binary directly, or first
 * sees the released generation and re-checks — it must reuse the binary, never
 * rebuild it and never report the routine release as reclaiming an abandoned
 * lock.
 *
 * 1. Start a holder worker whose fake `go build` writes a barrier file and blocks;
 *    start a waiter on the same cache key once the barrier exists.
 * 2. Release the holder after the waiter's fake-go invocation log shows it passed
 *    its pre-lock toolchain probes; the holder publishes and exits 0.
 * 3. Assert both workers exit 0 and print the same binary path.
 * 4. Assert the waiter never ran `go build`, never printed the cold-build banner,
 *    and never reported an abandoned lock.
 *
 * @evidence contracts/testing.md#behavioral-verification Both real workers must succeed and return one binary path with the literal published bytes; the waiter must have no build invocation, cold-build banner or abandoned-lock diagnostic.
 * @evidence contracts/testing.md#independent-expectations Holder build and waiter pre-lock probe files establish observed sequencing, not an independently witnessed blocked-lock interleaving. The waiter invocation log exposes an extra build even if it returned the same pathname.
 * @evidence contracts/testing.md#distinguishing-cases Publication during normal release is the positive handoff, with negative build/banner/abandonment/invalid-age controls; the failure-side twin separately owns reacquisition after a failed payload.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this generic async export, starting real holder/waiter processes invoking the built workspace builder and scripted Go admission fixture, then observing actual statuses/signals and publication bytes; real Go semantics/packed installation are not certified.
 * @evidence contracts/e2e.md#necessary-boundary Cross-process publication visibility must connect ordinary lease release to the waiting builder without misclassifying abandonment or duplicating payload work; pure result equality cannot establish the no-build process behavior.
 * @evidence contracts/e2e.md#shared-execution One source tree, worker script, cache key and fixture compiler serve both roles; only the holder produces the binary, and the waiter process is the consumer whose absence of build is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private role-specific barriers/logs and child-only hooks isolate this fresh publication graph. Workers register immediately; body/barrier-release/registered-worker failures aggregate. Ordinary helper outcomes settle on actual direct close; a separate deadline rejects unresolved ownership rather than certifying kill/join, and root is retained before preparation. Probe log does not prove blocked-lock observation or arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Same path, literal bytes, both statuses and every negative waiter log/diagnostic assertion remain here; the invocation log, not pathname equality alone, distinguishes reuse from rebuilding.
 */
export const test_buildsourceplugin_waiter_reuses_binary_published_during_release =
  async () => {
    const root = TestProject.tmpdir("ttsc-lock-publish-");
    TestProject.retainTemporaryDirectory(root, "publication worker graph may outlive its close deadline");
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

    const workers: Array<ReturnType<typeof spawnSourcePluginWorker>> = [];
    const failures: unknown[] = [];
    try {
      const holder = spawnSourcePluginWorker({
        env: {
          FAKE_GO_BUILD_BARRIER_FILE: holderBarrier,
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

      assert.equal(holderResult.signal, null, "holder terminated by signal");
      assert.equal(holderResult.status, 0, holderResult.stderr);
      assert.equal(waiterResult.signal, null, "waiter terminated by signal");
      assert.equal(waiterResult.status, 0, waiterResult.stderr);
      const holderBinary = holderResult.stdout.trim();
      const waiterBinary = waiterResult.stdout.trim();
      assert.equal(waiterBinary, holderBinary);
      assert.equal(fs.readFileSync(waiterBinary, "utf8"), "fake plugin binary\n");
      assert.doesNotMatch(fs.readFileSync(waiterLog, "utf8"), /^build /m);
      assert.doesNotMatch(waiterResult.stderr, /building source plugin/);
      assert.doesNotMatch(waiterResult.stderr, /reclaiming abandoned/);
      assert.doesNotMatch(waiterResult.stderr, /Infinitym|NaNs/);
    } catch (error) {
      failures.push(error);
    } finally {
      for (const releaseFile of [holderRelease]) {
        try {
          fs.writeFileSync(releaseFile, "release\n", "utf8");
        } catch (error) {
          failures.push(error);
        }
      }
      for (const outcome of await Promise.allSettled(workers)) {
        if (outcome.status === "rejected" && !failures.includes(outcome.reason))
          failures.push(outcome.reason);
      }
    }
    if (failures.length) throw new AggregateError(failures, "publication handoff or worker cleanup failed");
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
