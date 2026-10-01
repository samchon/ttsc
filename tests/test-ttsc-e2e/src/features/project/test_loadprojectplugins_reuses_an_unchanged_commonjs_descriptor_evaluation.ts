import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies an unchanged CommonJS plugin descriptor is not evaluated again by a
 * later load, and a change to what it read or ran under is.
 *
 * Every load evaluated the descriptor in a fresh runtime process, seconds per
 * launch on Windows, although the descriptor, its dependencies, and the
 * environment were identical to the previous launch's (samchon/ttsc#1497). The
 * evaluation's answer is now kept with the state of every input it read, and
 * handed out while each still holds that state. The descriptor reads no file
 * outside its module graph and says so with an empty `hostInputHashes`, which
 * is what lets its answer be recorded (samchon/ttsc#1561).
 *
 * 1. Load a project whose descriptor requires a helper and appends to a counter
 *    file each time its factory runs, twice with the same cache.
 * 2. Edit the helper, and load again.
 * 3. Change a variable of the environment, and load again.
 * 4. Assert the factory ran once for the first two loads, again after the edit,
 *    again under the new environment, and that each load returned the
 *    descriptor its inputs describe.
 *
 * @evidence contracts/testing.md#behavioral-verification Repeated unchanged CommonJS loads reuse the counted descriptor evaluation, while changed dependencies require another evaluation.
 * @evidence contracts/testing.md#independent-expectations The fixture factory counter and authored dependency generations independently distinguish cache reuse from repeated work or stale answers.
 * @evidence contracts/testing.md#distinguishing-cases 1. Load a project whose descriptor requires a helper and appends to a counter file each time its factory runs, twice with the same cache. 2. Edit the helper, and load again. 3. Change a variable of the environment, and load again. 4. Assert the factory ran once for the first two loads, again after the edit, again under the new environment, and that each load returned the descriptor its inputs describe.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Repeated unchanged CommonJS loads reuse the counted descriptor evaluation, while changed dependencies require another evaluation. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_reuses_an_unchanged_commonjs_descriptor_evaluation =
  () => {
    const root = TestProject.tmpdir("ttsc-descriptor-evaluation-cache-");
    const project = path.join(root, "project");
    writeGoModule(path.join(project, "go-plugin"));
    const counter = path.join(root, "evaluations.txt");
    write(
      path.join(project, "package.json"),
      JSON.stringify({ private: true }),
    );
    write(
      path.join(project, "helper.cjs"),
      `module.exports = { name: "first" };\n`,
    );
    write(
      path.join(project, "plugin.cjs"),
      [
        `const fs = require("node:fs");`,
        `const helper = require("./helper.cjs");`,
        `module.exports = (context) => {`,
        `  fs.appendFileSync(process.env.DESCRIPTOR_COUNTER, "x");`,
        `  return {`,
        `    hostInputHashes: {},`,
        `    name: helper.name,`,
        `    source: context.dirname + "/go-plugin",`,
        `  };`,
        `};`,
        ``,
      ].join("\n"),
    );
    write(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          plugins: [{ transform: "./plugin.cjs" }],
        },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const baseEnv = {
      ...process.env,
      DESCRIPTOR_COUNTER: counter,
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
    };
    const load = (env: NodeJS.ProcessEnv = baseEnv): string | undefined =>
      loadProjectPlugins({
        binary: "",
        cacheDir: path.join(root, "cache"),
        cwd: project,
        env,
        tsconfig: path.join(project, "tsconfig.json"),
      }).nativePlugins[0]!.name;
    const evaluations = (): number =>
      fs.existsSync(counter) ? fs.readFileSync(counter, "utf8").length : 0;

    assert.equal(load(), "first");
    assert.equal(load(), "first");
    assert.equal(evaluations(), 1, "an unchanged descriptor is reused");

    write(
      path.join(project, "helper.cjs"),
      `module.exports = { name: "second" };\n`,
    );
    assert.equal(load(), "second");
    assert.equal(evaluations(), 2, "an edited dependency is evaluated again");

    assert.equal(load({ ...baseEnv, DESCRIPTOR_PROBE: "changed" }), "second");
    assert.equal(evaluations(), 3, "another environment is evaluated again");
  };

/** A Go module the fake toolchain accepts. */
function writeGoModule(directory: string): void {
  write(
    path.join(directory, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  write(path.join(directory, "main.go"), "package main\n");
  // The files the fake Go build requires of the module it compiles.
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    write(path.join(directory, relative), "package generated\n");
  }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
