import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies a watch cycle whose resident check host died still checks with the
 * compiler flags the user forwarded.
 *
 * A resident check host receives the forwarded tsgo flags through
 * `TTSC_TSGO_ARGS` when it starts. When a request to it fails, the cycle falls
 * back to the one-shot check command, which omitted that payload, so its
 * environment constructor cleared the variable and the recovery cycle checked a
 * different program than the user asked for: `--noImplicitAny` vanished and its
 * diagnostic with it.
 *
 * 1. Start `ttsc --noEmit --watch --noImplicitAny` on a non-strict lint project
 *    whose source has an implicitly typed parameter.
 * 2. Record the healthy resident cycle's TS7006.
 * 3. Kill the resident host and edit the source so the next cycle falls back.
 * 4. Assert the fallback cycle reports TS7006 again.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch reports TS7006 in a healthy resident cycle and exactly one additional TS7006 after killing that resident and editing the source.
 * @evidence contracts/testing.md#independent-expectations The explicit untyped parameter and forwarded noImplicitAny require TS7006 independently of strict:false config; the measured healthy count establishes the prior stream boundary rather than an expected diagnostic body.
 * @evidence contracts/testing.md#distinguishing-cases Owns healthy resident versus dead-host one-shot fallback under the same forwarded flag, complementing normal source/root/config resident transitions.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export drives one real WatchSession, native lint process and OS process termination through the native E2E selection; no Linux-only admission is encoded by this named body.
 * @evidence contracts/e2e.md#necessary-boundary The watcher must carry compiler flags from resident startup into fallback spawn after a real child death; direct argument composition cannot prove failure recovery uses the same payload.
 * @evidence contracts/e2e.md#shared-execution The unchanged lint producer shares the batch plugin cache and Go objects; healthy and fallback cycles use one watcher, with fallback required by the deliberately stopped resident. Actual fallback/native/Program populations require their own observations rather than host or banner counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The isolated project owns strict:false config and source, the test stops the safe positive non-self PID obtained from actual telemetry. After the first new marker it waits for started cycles to settle within the original recovery deadline before reading diagnostics. Finally retains body and close causes; nonce receipt/direct-child close is not arbitrary descendant retirement or forced-interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original healthy diagnostic presence, integer PID, recovery-cycle deadline and healthy-count-plus-one assertions remain; no real fallback is replaced with a simulated client failure.
 */
export async function test_plugin_corpus_check_watch_fallback_keeps_forwarded_compiler_flags(): Promise<void> {
  const root = setupLintProject("lint-violations");
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions: Record<string, unknown>;
  };
  config.compilerOptions.strict = false;
  fs.writeFileSync(tsconfig, JSON.stringify(config), "utf8");
  fs.writeFileSync(
    path.join(root, "lint.config.json"),
    JSON.stringify({ rules: {} }),
  );
  const source = path.join(root, "src", "main.ts");
  fs.writeFileSync(
    source,
    "export function echo(value) {\n  return value;\n}\n",
  );

  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics", "--noImplicitAny"],
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  const failures: unknown[] = [];
  try {
    await session.waitForBuilds(1, 300_000);
    // A rerun queued during a cold first build would replace the resident
    // this test is about to stop, so every cycle so far has run first.
    await session.waitForSettled();
    const healthy = session.transcript();
    const healthyCount = countTs7006(healthy);
    assert.ok(healthyCount >= 1, healthy);
    const pid = Number(
      [...healthy.matchAll(/@ttsc\/lint resident check: pid=(\d+)/g)].at(
        -1,
      )?.[1],
    );
    assert.ok(Number.isInteger(pid), healthy);
    assert.ok(Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid, healthy);

    process.kill(pid);
    fs.appendFileSync(source, "// edited after the resident host died\n");
    const deadline = Date.now() + 120_000;
    while (
      !session.transcript().slice(healthy.length).includes("watch build")
    ) {
      assert.ok(Date.now() < deadline, session.transcript());
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await session.waitForSettled(300, Math.max(1, deadline - Date.now()));
    const recovered = session.transcript();
    assert.equal(
      countTs7006(recovered),
      healthyCount + 1,
      `the fallback cycle must keep --noImplicitAny:\n${recovered}`,
    );
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
    throw new AggregateError(failures, "Resident check watch and shutdown failed");
}

function countTs7006(transcript: string): number {
  return transcript.match(/TS7006/g)?.length ?? 0;
}
