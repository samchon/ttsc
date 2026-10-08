import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a generation is compiled again once its plugin's own Go source is
 * edited in place, both where it is validated on every delivery and at the
 * start of a build pass, and not for a write the plugin build never keys on
 * (samchon/ttsc#1487).
 *
 * A plugin's binary is keyed on its source, so a plugin edited in place changes
 * the output of every module, but the envelope carried only the JavaScript-host
 * files around it: the generation compiled by the old binary kept being served
 * until an unrelated input moved. The envelope now reports the source's state,
 * and the generation proves it like any universal input.
 *
 * 1. Copy the fixture plugin's Go source into the project and point its descriptor
 *    there; deliver the module from a persistent cache and, in a pass, from a
 *    second one, and assert both compiled the plugin's output.
 * 2. Write below the source's `node_modules` and `.git`, deliver from both again,
 *    and assert nothing compiled.
 * 3. Edit the plugin's Go source so its output changes, deliver from both again,
 *    and assert each compiled once more and serves the new output.
 *
 * @evidence contracts/testing.md#behavioral-verification Persistent and build-pass caches produce PLUGIN/count two, ignore .git/node_modules writes, then both produce PLUGIN-EDITED/count four after Go source edit.
 * @evidence contracts/testing.md#independent-expectations Authored private producer edit and byte counter independently distinguish binary change from pruned noise.
 * @evidence contracts/testing.md#distinguishing-cases Persistent versus pass validation, pruned source-tree writes, actual producer source edit.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_recompiles_after_its_plugin_source_is_edited owns two native caches across pruned noise and an edited private Go producer source. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for persistent versus pass validation, pruned source-tree writes, actual producer source edit. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Persistent and build-pass caches produce PLUGIN/count two, ignore .git/node_modules writes, then both produce PLUGIN-EDITED/count four after Go source edit. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_recompiles_after_its_plugin_source_is_edited(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-plugin-source-log-"),
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
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);
  const persistent = createTtscTransformCache();
  const passes = createTtscTransformCache();
  const deliver = async (cache: typeof persistent) =>
    (
      await transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        resolveOptions(),
        undefined,
        cache,
      )
    )?.code ?? "";

  // 1. Both compile the plugin's output.
  assert.match(await deliver(persistent), /"PLUGIN"/);
  beginTtscTransformBuild(passes);
  assert.match(await deliver(passes), /"PLUGIN"/);
  assert.equal(compiles(), 2);

  // 2. What the build never keys on moves nothing.
  for (const pruned of ["node_modules", ".git"]) {
    fs.mkdirSync(path.join(source, pruned), { recursive: true });
    fs.writeFileSync(path.join(source, pruned, "ignored.go"), "package x\n");
  }
  assert.match(await deliver(persistent), /"PLUGIN"/);
  beginTtscTransformBuild(passes);
  assert.match(await deliver(passes), /"PLUGIN"/);
  assert.equal(compiles(), 2, "a pruned write compiles nothing");

  // 3. An edit of the source compiles each once more, with the new plugin.
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
  assert.match(await deliver(persistent), /"PLUGIN-EDITED"/);
  beginTtscTransformBuild(passes);
  assert.match(await deliver(passes), /"PLUGIN-EDITED"/);
  assert.equal(compiles(), 4, "each compiled the edited plugin's output");
}
