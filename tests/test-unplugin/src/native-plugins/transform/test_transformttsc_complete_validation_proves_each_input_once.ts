import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies the complete-snapshot path proves each input once per generation.
 *
 * With notifications unavailable, every delivery re-proves the recorded
 * snapshot from disk, so a metadata-only change to any input would cost a
 * re-read for the rest of the generation's life unless the walk that proved the
 * snapshot hands its signatures back. The delivered file is proven from disk
 * like every other input, because the compile reads the disk
 * (samchon/ttsc#1394), so a stale delivered text cannot hide an edit.
 *
 * 1. Compile through a cache whose watches are refused, counting file reads.
 * 2. Touch an input and assert no recompile, with the changed signature re-proven
 *    once and then not reread.
 * 3. Edit a module on disk, deliver it with its old text, and assert the delivery
 *    recompiles from disk and reports the difference, and a sibling reuses that
 *    compile.
 */
export async function test_transformttsc_complete_validation_proves_each_input_once(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
    // Refusing every watch registration keeps the generation on the
    // whole-snapshot path for every delivery.
    watch: () => {
      const error = new Error(
        "watch registration refused",
      ) as NodeJS.ErrnoException;
      error.code = "ENOSPC";
      throw error;
    },
  });
  const options = resolveOptions();
  const deliver = (file: string, source?: string) =>
    transformTtsc(
      file,
      source ?? fs.readFileSync(file, "utf8"),
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
  assert.equal(pluginRuns(), 1);
  reads = 0;
  assert.ok(await deliver(modules[1]!));
  const steady = reads;

  // A metadata-only change to a project input and to an out-of-walk input costs
  // one re-read each, once.
  // A restored-from-backup timestamp: the content is untouched, so only the
  // signature moves.
  const shifted = new Date(0);
  fs.utimesSync(path.join(project.root, "src", "mod4.ts"), shifted, shifted);
  fs.utimesSync(
    path.join(project.root, "node_modules", "dep2", "index.d.ts"),
    shifted,
    shifted,
  );
  reads = 0;
  assert.ok(await deliver(modules[1]!));
  assert.equal(pluginRuns(), 1, "a touch must not recompile");
  assert.ok(
    reads > steady,
    "a changed metadata signature must fall back to the content comparison",
  );
  reads = 0;
  assert.ok(await deliver(modules[2]!));
  assert.ok(
    reads <= steady,
    `a re-proven input must not be reread per delivery (read ${reads}, steady ${steady})`,
  );

  // A stale delivered text cannot hide an edit on disk: the compile reads the
  // disk, so the delivered file is proven from it like any other input.
  const drifting = path.join(project.root, "src", "mod0.ts");
  const stale = fs.readFileSync(drifting, "utf8");
  fs.writeFileSync(
    drifting,
    'export const value0: string = "PROBE-DRIFTED";\n',
    "utf8",
  );
  const write = process.stderr.write.bind(process.stderr);
  let reported = "";
  process.stderr.write = ((chunk: unknown) => {
    reported += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  let drifted;
  try {
    drifted = await deliver(drifting, stale);
  } finally {
    process.stderr.write = write;
  }
  assert.ok(drifted);
  assert.match(drifted.code, /DRIFTED/, "the output is the disk's");
  assert.equal(pluginRuns(), 2, "an edit on disk recompiles");
  assert.match(reported, /differs from the file on disk/);
  assert.ok(await deliver(modules[3]!));
  assert.equal(pluginRuns(), 2, "a sibling reuses the recompiled generation");
}
