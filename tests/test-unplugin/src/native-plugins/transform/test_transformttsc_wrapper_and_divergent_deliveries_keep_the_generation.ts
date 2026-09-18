import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies neither a host-generated wrapper nor a delivered text that differs
 * from the file can replace or thrash the generation (samchon/ttsc#1394).
 *
 * A module imported both plainly and as `?raw` was delivered twice with two
 * texts for one file. Each mismatch recompiled the project, and the wrapper's
 * text became the file's recorded hash. A plugin ordered before ttsc caused the
 * same thing permanently: its rewritten text replaced the file's hash, and
 * every sibling delivery, which compares the disk, then recompiled. The compile
 * reads the disk, so the delivered text now never becomes the file's state. A
 * difference is reported once, and only a real edit recompiles.
 *
 * 1. Deliver a module as `?raw` with its wrapper code and assert nothing is
 *    compiled or returned.
 * 2. Compile it plainly, then deliver `?raw` and a `?t=` variant again, and assert
 *    both leave the generation alone.
 * 3. Deliver a sibling rewritten by an earlier plugin, twice, then another
 *    sibling, and assert one report and no recompile.
 * 4. Edit that sibling on disk and assert its next delivery recompiles.
 */
export async function test_transformttsc_wrapper_and_divergent_deliveries_keep_the_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 3 });
  const [main, rewritten, sibling] = projectModules(project.root) as [
    string,
    string,
    string,
  ];
  const cache = createTtscTransformCache();
  const options = resolveOptions();
  const deliver = (id: string, source: string) =>
    transformTtsc(id, source, options, undefined, cache);
  const runs = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const read = (file: string) => fs.readFileSync(file, "utf8");
  const wrapper = `export default ${JSON.stringify(read(main))};\n`;

  assert.equal(await deliver(`${main}?raw`, wrapper), undefined);
  assert.equal(runs(), 0, "a wrapper never compiles the project");

  assert.match((await deliver(main, read(main)))!.code, /PROBED/);
  assert.equal(runs(), 1);
  assert.equal(await deliver(`${main}?raw`, wrapper), undefined);
  assert.match((await deliver(`${main}?t=1`, read(main)))!.code, /PROBED/);
  assert.equal(runs(), 1, "a wrapper beside the program keeps the generation");

  const reports: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    if (String(chunk).includes("differs from the file on disk"))
      reports.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    const altered = `${read(rewritten)}// rewritten by an earlier plugin\n`;
    assert.match((await deliver(rewritten, altered))!.code, /PROBED/);
    assert.match((await deliver(rewritten, altered))!.code, /PROBED/);
    assert.match((await deliver(sibling, read(sibling)))!.code, /PROBED/);
  } finally {
    process.stderr.write = write;
  }
  assert.equal(runs(), 1, "a divergent delivery never recompiles the project");
  assert.equal(reports.length, 1, "the difference is reported once");

  fs.writeFileSync(
    rewritten,
    'export const value1: string = "PROBE-EDITED";\n',
  );
  assert.ok(await deliver(rewritten, read(rewritten)));
  assert.equal(runs(), 2, "a real edit still recompiles");
}
