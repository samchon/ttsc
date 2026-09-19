import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

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
