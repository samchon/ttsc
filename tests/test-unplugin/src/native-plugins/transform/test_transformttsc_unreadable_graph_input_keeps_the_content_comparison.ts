import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a graph member with no readable content never acquires a signature.
 *
 * A signature stands for the bytes a read proved. A member the compiler
 * recorded without a content hash, which the host can stat but not read,
 * matches its recorded missing state exactly while unreadable. Handed a
 * signature at capture, it could become readable without a metadata change and
 * the narrow path would skip it forever, replaying output computed from
 * nothing.
 *
 * 1. Compile a project whose graph records one member without a content hash,
 *    readable by nothing.
 * 2. Assert deliveries hit the cache while the member stays unreadable.
 * 3. Make its content readable without moving its metadata, and assert the
 *    contradiction ends after one bounded retry wave.
 */
export async function test_transformttsc_unreadable_graph_input_keeps_the_content_comparison(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 4,
    unhashedGraphInput: true,
  });
  const modules = projectModules(project.root);
  const unreadable = path.join(
    project.root,
    "node_modules",
    "dep0",
    "index.d.ts",
  );
  let denied = true;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      if (denied && path.resolve(location) === unreadable) {
        const error = new Error("permission denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return fs.readFileSync(location);
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    1,
    "an unreadable member matching its recorded state must still hit the cache",
  );

  // Readable again, with every byte of metadata unchanged: only a content
  // comparison can see this.
  denied = false;
  await assert.rejects(
    () => deliver(modules[0]!),
    /after 2 attempts[\s\S]*graph\/content-changed[\s\S]*dep0\/index\.d\.ts/,
  );
  assert.equal(
    pluginRuns(),
    3,
    "a producer contradiction must terminate after one bounded retry wave",
  );
}
