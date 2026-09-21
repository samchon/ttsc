import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies the Turbopack loader never registers a path that may come back as a
 * directory on Turbopack's file channel, so a dependency directory renamed away
 * and back cannot fail the evaluation and cross the pool's results.
 *
 * Turbopack's file channel, `addDependency`, reads each registered path once
 * the loader has returned, and the read fails on a directory. A failed read
 * fails the module's evaluation, after which Turbopack returns the worker to
 * its pool with the loader's result still unread in the pipe: the next module
 * evaluated on that worker receives this module's code, and every later one the
 * code of the module before. Measured on the host matrix, where the page was
 * served the entry's code under its own path after its dependency directory
 * came back. The failed compile had registered the absent directory as a
 * missing path, with no evidence of what would appear there, and the directory
 * was back by the time Turbopack read it. A missing path that can come back as
 * nothing but a file keeps the file channel; a directory, or a path the
 * registration cannot shape, takes the directory channel, whose read of a
 * missing path, a file, or a directory never fails.
 *
 * 1. Run the loader, with an error channel, on an entry whose type import resolves
 *    through a directory that does not exist, so the compile fails and
 *    registers its recovery inputs.
 * 2. Assert the absent directory reached the directory channel and no directory
 *    reached the file channel.
 * 3. Create the directory with the declaration and run the loader again, and
 *    assert the entry is served and, again, no directory reached the file
 *    channel.
 */
export async function test_turbopack_loader_keeps_a_directory_off_turbopacks_file_channel(): Promise<void> {
  const root = TestUnpluginProject.createProject({
    plugins: [],
    source:
      'import type { Local } from "./deps/local";\nexport const local: Local = "ok";\n',
  });
  const deps = path.join(root, "src", "deps");
  const declaration = path.join(deps, "local.d.ts");
  const props = {
    emitErrors: true,
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  };
  const onlyFiles = (dependencies: string[], label: string): void => {
    for (const dependency of dependencies) {
      let directory = false;
      try {
        directory = fs.statSync(dependency).isDirectory();
      } catch {
        // Absent: a file the compiler looked for.
      }
      assert.equal(directory, false, `${label}: ${dependency} is a directory`);
    }
  };

  const failed = await runTurbopackLoaderWithContext(props);
  assert.equal(failed.emitted.length, 1, "the compile failed");
  assert.match(failed.emitted[0]!.message, /deps\/local/);
  assert.ok(
    failed.contextDependencies.includes(deps),
    `the absent directory takes the directory channel: ${JSON.stringify(failed.contextDependencies)}`,
  );
  assert.equal(
    failed.dependencies.includes(deps),
    false,
    "the absent directory stays off the file channel",
  );
  onlyFiles(failed.dependencies, "after the failed compile");

  fs.mkdirSync(deps);
  fs.writeFileSync(declaration, 'export type Local = "ok";\n');
  const served = await runTurbopackLoaderWithContext(props);
  assert.equal(served.emitted.length, 0, "the repaired project compiles");
  assert.match(served.content, /"ok"/);
  onlyFiles(served.dependencies, "after the repair");
}
