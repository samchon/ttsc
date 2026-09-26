import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createProjectWithExternalInput } from "../../internal/transform-external/createProjectWithExternalInput";

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
