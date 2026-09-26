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
 * handed out while each still holds that state.
 *
 * 1. Load a project whose descriptor requires a helper and appends to a counter
 *    file each time its factory runs, twice with the same cache.
 * 2. Edit the helper, and load again.
 * 3. Change a variable of the environment, and load again.
 * 4. Assert the factory ran once for the first two loads, again after the edit,
 *    again under the new environment, and that each load returned the
 *    descriptor its inputs describe.
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
        `  return { name: helper.name, source: context.dirname + "/go-plugin" };`,
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
