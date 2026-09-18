import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/** A persistently unreadable project walk terminates after the retry bound. */
export async function test_transformttsc_persistent_incomplete_project_snapshot_fails_after_bounded_attempts(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 2,
    fileCount: 2,
    graphFanout: 2,
  });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  let failures = 0;
  let blocked = true;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        blocked &&
        fs.existsSync(project.runLog)
      ) {
        failures += 1;
        throw new Error("persistent project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const main = path.join(project.root, "src", "mod0.ts");
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  let terminal: Error | undefined;
  await assert.rejects(
    () =>
      transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        options,
        undefined,
        cache,
      ),
    (error: Error) => {
      terminal = error;
      assert.match(error.message, /after 2 attempts/);
      assert.match(error.message, /project\/directory-read-failed/);
      assert.match(error.message, /src\/transient/);
      return true;
    },
  );
  assert.ok(failures >= 3, "both attempts must exercise the failed walk");
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
  assert.equal(cache.size, 1);

  for (const sibling of externalSourceModules(project.root, 2)) {
    await assert.rejects(
      () =>
        transformTtsc(
          sibling,
          fs.readFileSync(sibling, "utf8"),
          options,
          undefined,
          cache,
        ),
      (error: Error) => error === terminal,
    );
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "an unchanged failed environment must not start another attempt wave",
  );

  blocked = false;
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    3,
    "a confirmed project-walk recovery must replace the failed generation",
  );
  assert.equal(cache.size, 1);
}
