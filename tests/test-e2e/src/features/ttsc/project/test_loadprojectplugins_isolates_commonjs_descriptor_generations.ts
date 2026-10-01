import { TestProject } from "@ttsc/testing";
import { createRequire } from "node:module";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies CommonJS descriptors reload in isolation from the application cache.
 *
 * Descriptor factories may lazily require config modules outside their package.
 * Those modules must be reported as host inputs and re-evaluated after edits,
 * including after an earlier load threw. Reloading must not evict an
 * application singleton that happened to be shared with the descriptor graph.
 *
 * @evidence contracts/testing.md#behavioral-verification A failed descriptor load recovers after edits, reports lazy dependencies and preserves the application singleton with its original bad selection.
 * @evidence contracts/testing.md#independent-expectations The authored bad/good dependency versions and the separately retained application object distinguish descriptor reload from eviction of application require cache.
 * @evidence contracts/testing.md#distinguishing-cases A failed descriptor load recovers after edits, reports lazy dependencies and preserves the application singleton with its original bad selection.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage A failed descriptor load recovers after edits, reports lazy dependencies and preserves the application singleton with its original bad selection. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_isolates_commonjs_descriptor_generations =
  () => {
    const root = TestProject.tmpdir("ttsc-cjs-descriptor-isolation-");
    const project = path.join(root, "project");
    const shared = path.join(root, "shared.cjs");
    const getterSelectionBase = path.join(root, "getter-selection");
    const getterSelection = `${getterSelectionBase}.json`;
    const descriptor = path.join(project, "plugin.cjs");
    const source = path.join(root, "plugin-go");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: descriptor }] },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(source, "go.mod"),
      "module example.com/descriptor-isolation\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(source, "main.go"),
      "package main\n\nfunc main() {}\n",
    );
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const file = path.join(source, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "package generated\n", "utf8");
    }
    fs.writeFileSync(
      shared,
      "module.exports = { selection: 'bad' };\n",
      "utf8",
    );
    fs.writeFileSync(getterSelection, JSON.stringify(source), "utf8");
    fs.writeFileSync(
      descriptor,
      [
        "module.exports = () => {",
        `  const shared = require(${JSON.stringify(shared)});`,
        "  if (shared.selection === 'bad') throw new Error('descriptor is bad');",
        "  return {",
        "    name: shared.selection,",
        `    get source() { return require(${JSON.stringify(getterSelectionBase)}); },`,
        "  };",
        "};",
        "",
      ].join("\n"),
      "utf8",
    );

    const requireFromTest = createRequire(import.meta.url);
    const applicationSingleton = requireFromTest(shared);
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const env = {
      ...process.env,
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
    };
    const load = () =>
      loadProjectPlugins({
        binary: "",
        cacheDir: path.join(root, "cache"),
        cwd: project,
        env,
        tsconfig: path.join(project, "tsconfig.json"),
      });

    assert.throws(load, /descriptor is bad/);
    fs.writeFileSync(
      shared,
      "module.exports = { selection: 'good' };\n",
      "utf8",
    );
    const first = load();
    assert.ok(first.hostInputs.includes(shared));
    assert.ok(first.hostInputs.includes(getterSelection));
    assert.ok(first.hostInputs.includes(`${getterSelectionBase}.js`));
    assert.equal(
      first.hostInputRealpaths[shared],
      fs.realpathSync.native(shared),
    );
    assert.equal(
      first.hostInputRealpaths[getterSelection],
      fs.realpathSync.native(getterSelection),
    );
    assert.equal(first.nativePlugins[0]?.name, "good");
    const second = load();
    assert.equal(second.nativePlugins[0]?.name, "good");
    assert.equal(requireFromTest(shared), applicationSingleton);
    assert.equal(applicationSingleton.selection, "bad");
  };
