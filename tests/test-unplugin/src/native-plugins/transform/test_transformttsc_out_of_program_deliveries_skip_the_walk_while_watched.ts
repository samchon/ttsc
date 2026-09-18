import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { programRuns } from "../../internal/real-native-envelope/programRuns";

/**
 * Verifies a persistent host answers a module outside the program from its
 * watchers instead of walking the project on every delivery
 * (samchon/ttsc#1398).
 *
 * Every delivery of such a module used to re-walk the project and re-hash every
 * out-of-walk input to confirm it was still outside the program, even though
 * the generation's live watchers already prove that neither membership nor any
 * input had changed. A page load that requests many such modules paid that walk
 * per module.
 *
 * 1. Compile a real native envelope in a persistent cache, then deliver a module
 *    outside the program's `include` twenty times, and assert no directory was
 *    listed.
 * 2. Add a source to the program and assert a later delivery recompiles.
 */
export async function test_transformttsc_out_of_program_deliveries_skip_the_walk_while_watched(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  let listings = 0;
  const cache = api.createTtscTransformCache({
    readdir: (location: string) => {
      listings += 1;
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  const stray = path.join(fixture.root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  fs.writeFileSync(stray, "export const tool: string = 'STRAY';\n");
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    assert.ok(await deliver(fixture.modules[0]!));
    assert.equal(programRuns(fixture.runLog), 1);
    await new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

    listings = 0;
    for (let index = 0; index < 20; index += 1) {
      assert.equal(await deliver(stray), undefined);
    }
    assert.equal(listings, 0, "the watchers answer for an unchanged program");

    fs.writeFileSync(
      path.join(path.dirname(fixture.modules[0]!), "added.ts"),
      "export const added = 1;\n",
    );
    await waitFor(async () => {
      await deliver(stray);
      return programRuns(fixture.runLog) === 2;
    }, "a membership change to reach an out-of-program delivery");
  } finally {
    process.stderr.write = original;
  }
}
