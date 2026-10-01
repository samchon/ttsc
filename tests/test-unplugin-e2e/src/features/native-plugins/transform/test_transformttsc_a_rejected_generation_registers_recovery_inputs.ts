import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscWatchInput } from "../../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";
import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../internal/transform-project-cache/projectModules";

/**
 * Verifies a delivery whose generation was rejected, rather than answered with
 * a failed envelope, still registers the inputs a host must watch to re-run the
 * module (samchon/ttsc#1446).
 *
 * A host that records a module's dependencies per run, as Turbopack does, keeps
 * only what the failed run registered. A rejection that registered nothing left
 * the module with no dependencies, so no later edit re-ran it and the page kept
 * the error. Measured on real `next dev` about once in twenty runs, when the
 * page's modules compiled in parallel right after a breaking edit.
 *
 * 1. Make the project walk fail so the generation is rejected as unstable, and
 *    deliver a module with the failed-registration hook; assert the hook
 *    received the failed recovery inputs, the project's own files among them.
 * 2. Deliver another module in the same pass, which replays the terminal verdict,
 *    and assert it registers them as well.
 * 3. Recover the walk in a new pass and assert a successful delivery registers its
 *    inputs without the failed flag.
 *
 * @evidence contracts/testing.md#behavioral-verification A post-compile walk rejection must register the module and tsconfig with failed=true; a sibling replay in the same pass adds another failed registration, and repaired walk in a new pass returns output with a non-failed registration.
 * @evidence contracts/testing.md#independent-expectations A host retaining per-run dependencies needs source/config recovery inputs even when no envelope is deliverable. Literal failed flags, path inclusion, registration-count increment and returned result require observable recovery routing; they do not derive the expected set from the rejected cache.
 * @evidence contracts/testing.md#distinguishing-cases Initial unstable rejection, same-pass terminal replay and recovered next-pass success each exercise registration ownership. This differs from a native compiler diagnostic, whose recovery envelope is covered separately.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_rejected_generation_registers_recovery_inputs in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject, shared sidecar artifact and cache serve all three deliveries. The blocked walk is a local seam; native build preparation is shared and only bounded rejected attempts plus the recovered capture are necessary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique fixture/log roots isolate the transient directory. Registrations intentionally accumulate with last-registration inspection, blocked changes before the recovery pass and beginTtscTransformBuild establishes that transition. No explicit cache reset is present, so retained resources and temporary roots end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_rejected_generation_registers_recovery_inputs; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_rejected_generation_registers_recovery_inputs(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  let blocked = true;
  const cache = api.createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        blocked &&
        fs.existsSync(project.runLog)
      ) {
        throw new Error("project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const modules = projectModules(project.root);
  const options = api.resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const registrations: { failed: boolean | undefined; files: string[] }[] = [];
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      {
        addWatchFiles: (
          inputs: readonly TtscWatchInput[],
          failed?: boolean,
        ) => {
          registrations.push({
            failed,
            files: inputs.map((input) => path.resolve(input.file)),
          });
        },
      },
    );
  const lastRegistration = () => {
    const last = registrations.at(-1);
    assert.ok(last !== undefined, "the delivery registered inputs");
    return last;
  };

  api.beginTtscTransformBuild(cache);
  await assert.rejects(() => deliver(modules[0]!), /after 2 attempts/);
  const rejected = lastRegistration();
  assert.equal(rejected.failed, true, "a rejection registers as a failure");
  assert.ok(
    rejected.files.includes(path.resolve(modules[0]!)),
    "the project's own files are among the recovery inputs",
  );
  assert.ok(
    rejected.files.includes(path.resolve(project.root, "tsconfig.json")),
    "the configuration is among them",
  );

  const before = registrations.length;
  await assert.rejects(() => deliver(modules[1]!), /after 2 attempts/);
  assert.equal(
    registrations.length,
    before + 1,
    "a replayed terminal verdict registers too",
  );
  assert.equal(lastRegistration().failed, true);

  blocked = false;
  api.beginTtscTransformBuild(cache);
  const result = await deliver(modules[0]!);
  assert.ok(result !== undefined);
  assert.notEqual(lastRegistration().failed, true, "a success is not failed");
}
