import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a new pass grants an unstable generation one fresh attempt.
 *
 * The two terminal verdict kinds part company across a pass boundary, and this
 * is the half that is easy to lose. A failed _compile_ is the host's answer
 * about inputs it read, so a new pass replays it. An unstable generation is the
 * adapter failing to obtain a coherent snapshot, which is a race it lost and a
 * later attempt may well win, so a new pass has to try again. That fresh
 * attempt is exactly what the per-pass cache clear used to provide for free,
 * and removing the branch that grants it would leave every existing case
 * green.
 *
 * The run log counts attempts rather than deliveries: the compile itself
 * succeeds here, and only the project-walk snapshot around it is torn, so each
 * bounded wave appends two entries.
 */
export async function test_transformttsc_a_new_pass_retries_an_unstable_generation(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  // The walk of this one directory fails for as long as it stays blocked, so
  // no attempt can ever prove a coherent snapshot and the generation stays
  // terminal without anything else about the project changing.
  let blocked = true;
  const cache = api.createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        blocked &&
        fs.existsSync(project.runLog)
      ) {
        throw new Error("pass-boundary project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const modules = projectModules(project.root);
  const options = api.resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const attempts = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );

  try {
    api.beginTtscTransformBuild(cache);
    let terminal: Error | undefined;
    await assert.rejects(
      () => deliver(modules[0]!),
      (error: Error) => {
        terminal = error;
        assert.match(error.message, /after 2 attempts/);
        return true;
      },
    );
    const spent = attempts();
    assert.ok(spent >= 2, "the first pass must spend its bounded attempts");

    // Same pass, unchanged environment: the verdict answers without recompiling.
    await assert.rejects(
      () => deliver(modules[1]!),
      (error: Error) => error === terminal,
    );
    assert.equal(
      attempts(),
      spent,
      "an unchanged environment must not start another wave inside the pass",
    );

    // A new pass is a fresh attempt, even though nothing about the project
    // moved. This is the branch the per-pass clear used to provide.
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /after 2 attempts/);
    assert.ok(
      attempts() > spent,
      "a new pass must grant an unstable generation a fresh attempt",
    );

    // And recovery still lands once the walk stops failing.
    blocked = false;
    api.beginTtscTransformBuild(cache);
    assert.ok(
      await deliver(modules[0]!),
      "a recovered project walk must produce a real generation",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
