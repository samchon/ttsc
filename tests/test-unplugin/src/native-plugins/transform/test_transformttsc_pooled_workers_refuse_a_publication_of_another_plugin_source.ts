import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../internal/pooled-session/runPooledWorker";

/**
 * Verifies a pooled worker refuses another worker's compile once the plugin's
 * Go source it was built from changed, and compiles with the plugin on its own
 * disk (samchon/ttsc#1487).
 *
 * A publication is named by the project's state and adopted after the adopter
 * proves it against its own disk. The plugin's source was in neither, so a
 * worker adopted output the old plugin produced after the plugin was edited.
 * The envelope now carries the source's digest, and the adopter proves it like
 * any universal input: a publication built from another source is refuted, and
 * the retry compiles the state and replaces it.
 *
 * 1. Copy the fixture plugin's Go source into the project, and publish the
 *    project's state from a worker process.
 * 2. Edit the plugin's Go source so its output changes, without touching the
 *    project.
 * 3. Deliver in this process through the same session, and assert it serves the
 *    edited plugin's output from a compile of its own.
 */
export async function test_transformttsc_pooled_workers_refuse_a_publication_of_another_plugin_source(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-plugin-source-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
      { transform: "./plugin.cjs", name: "upper", operation: "go-uppercase" },
    ],
  });
  // The project's own copy of the plugin's source, edited below; the shared
  // fixture stays as every other test built it.
  const source = path.join(root, "go-plugin");
  fs.cpSync(TestUnpluginProject.pluginSource(root), source, {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = (context) => ({ name: context.plugin.name, source: "./go-plugin" });\n',
  );
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-plugin-session-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  const published = await runPooledWorker({ file: main, session });
  assert.equal(published.error, undefined, published.error);
  assert.match(published.code ?? "", /"PLUGIN"/);
  assert.equal(compiles(), 1, "the state compiles once and is published");

  const program = path.join(source, "main.go");
  fs.writeFileSync(
    program,
    fs
      .readFileSync(program, "utf8")
      .replaceAll(
        "value = strings.ToUpper(value)",
        'value = strings.ToUpper(value) + "-EDITED"',
      ),
  );

  const cache = createTtscTransformCache();
  shareTtscTransformCache(cache, session);
  const result = await transformTtsc(
    main,
    fs.readFileSync(main, "utf8"),
    resolveOptions(),
    undefined,
    cache,
  );
  assert.match(result?.code ?? "", /"PLUGIN-EDITED"/, "the edited plugin");
  assert.equal(compiles(), 2, "from a compile of its own");
}
