import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createProjectWithExternalInput } from "../../../internal/transform-external/createProjectWithExternalInput";

/**
 * Verifies a generation never certifies a plugin-reported dependency with a
 * state it first read after its compile.
 *
 * A dependency-only path carries no compiler-time proof, and the capture read
 * it only after the compile returned. A plugin that read `first` while the path
 * changed to `second` before the compile returned produced `first` output
 * recorded beside the `second` hash, and every later delivery under `second`
 * reused it (samchon/ttsc#1541). The path is now certified only against a
 * witness read before the compile: a path the compile reports for the first
 * time is compiled again with one, and one whose witness moved is compiled
 * again as a moved project.
 *
 * 1. Hold the first compile after its plugin read `first`, change the path to
 *    `second`, and release it: the delivery serves `second`, from a second
 *    compile that witnessed the path, and the next delivery reuses it.
 * 2. Change the path to `third`, hold the compile after its plugin read it, change
 *    the path to `fourth`, and release it: the witnessed path moved, so the
 *    delivery serves `fourth`, and the next delivery reuses it.
 *
 * @evidence contracts/testing.md#behavioral-verification Held native reads spanning first-to-second and third-to-fourth edits serve SECOND then FOURTH, with two compiles per stabilization and no extra compile on replay.
 * @evidence contracts/testing.md#independent-expectations The plugin reads configured literal bytes before a barrier and a run counter independently identifies actual invocations.
 * @evidence contracts/testing.md#distinguishing-cases First-seen dependency needs a witnessed retry; later witnessed dependency moving during compile also retries, and both stable states are reused.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup. Explicit barrier/release files establish the native read-before-edit sequence; an assertion failing before release has only the existing bounded producer timeout, not an unconditional barrier cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Held native reads spanning first-to-second and third-to-fourth edits serve SECOND then FOURTH, with two compiles per stabilization and no extra compile on replay. These assertions remain in test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { external, relative, root } =
    createProjectWithExternalInput("first\n");
  const control = TestProject.tmpdir("ttsc-unplugin-dependency-witness-");
  const barrier = path.join(control, "barrier");
  const release = path.join(control, "release");
  const runLog = path.join(control, "compiles.bin");
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "hold",
        operation: "await-release",
        barrier,
        release,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative],
      },
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
    ],
  });
  const cache = createTtscTransformCache();
  const compiles = (): number =>
    fs.existsSync(runLog) ? fs.statSync(runLog).size : 0;
  const deliver = () =>
    transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    );
  // Deliver while the compile is held after its plugin read the path, write
  // `moved` into the path, and release the compile.
  const deliverAcross = async (moved: string) => {
    fs.rmSync(barrier, { force: true });
    fs.rmSync(release, { force: true });
    const delivery = deliver();
    const deadline = Date.now() + 120_000;
    while (!fs.existsSync(barrier)) {
      assert.ok(Date.now() < deadline, "the compile never reached its hold");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    fs.writeFileSync(external, moved, "utf8");
    fs.writeFileSync(release, "");
    return delivery;
  };

  const first = await deliverAcross("second\n");
  assert.ok(first);
  assert.match(first.code, /PLUGIN:SECOND/);
  assert.equal(compiles(), 2, "the path is compiled again, witnessed");
  const replayed = await deliver();
  assert.ok(replayed);
  assert.match(replayed.code, /PLUGIN:SECOND/);
  assert.equal(compiles(), 2, "the witnessed generation is reused");

  fs.writeFileSync(external, "third\n", "utf8");
  const moved = await deliverAcross("fourth\n");
  assert.ok(moved);
  assert.match(moved.code, /PLUGIN:FOURTH/);
  assert.equal(compiles(), 4, "the moved path is compiled again");
  const settled = await deliver();
  assert.ok(settled);
  assert.match(settled.code, /PLUGIN:FOURTH/);
  assert.equal(compiles(), 4, "the settled generation is reused");
}
