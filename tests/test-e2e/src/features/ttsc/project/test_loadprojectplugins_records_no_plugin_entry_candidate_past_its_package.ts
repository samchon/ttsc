import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a plugin entry named by a package records the candidates of the
 * search roots up to the one its package resolved in, and none past it.
 *
 * The loader fingerprints every candidate of the entry before it resolves the
 * entry, so a higher-priority file that appears meanwhile cannot bless the old
 * selection. It kept every one of them as an input, though the lookup stops at
 * the first root whose package it selects and never reads the roots after it:
 * each `node_modules` from the project's parent to the volume root stayed a
 * missing input of the project, which a consumer proves and watches for
 * nothing. It now keeps the candidates the lookup could have read, and their
 * pre-resolution fingerprints.
 *
 * 1. Install a descriptor package in the project's `node_modules` and name it as
 *    the plugin's `transform`.
 * 2. Load the project's plugins.
 * 3. Assert the installed entry is a proven input, and no candidate of the package
 *    lies in a search root past the project's own `node_modules`.
 *
 * @evidence contracts/testing.md#behavioral-verification The selected installed entry is proven and no package candidate beyond its selected node_modules root is reported.
 * @evidence contracts/testing.md#independent-expectations The descriptor package is authored in the project root and ordinary Node search stops there; farther absence observations cannot affect selection.
 * @evidence contracts/testing.md#distinguishing-cases 1. Install a descriptor package in the project's `node_modules` and name it as the plugin's `transform`. 2. Load the project's plugins. 3. Assert the installed entry is a proven input, and no candidate of the package lies in a search root past the project's own `node_modules`.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls workspace loadProjectPlugins and the actual isolated descriptor return/proof transport. Scripted Go publication is fixture preparation, not real Go compiler or packed-consumer semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution Each authored request uses its own fresh topology/cache and one load with the common scripted Go inventory. No warm hit, avoided preparation, Program reuse or actual child total is asserted; conditional evaluator selection needs actual observation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked roots are retained before preparation. Same-evaluator mutation belongs to its private topology, not a concurrent writer process. Synchronous returned output does not establish descendant join, and physical missing-path expectations propagate permission/other errors.
 * @evidence contracts/e2e.md#preserved-coverage The authored entry-descriptor package index is a proven host input, and its candidates outside the selected project node_modules are empty. This is parent plugin-entry resolution, not solely dependency lookup within a descriptor or a packed installation. Original input bytes/assertions and failure identities remain; runtime/manifest/survival unverified and donor retained.
 */
export const test_loadprojectplugins_records_no_plugin_entry_candidate_past_its_package =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-entry-search-roots-");
    TestProject.retainTemporaryDirectory(root, "Plugin entry proof descendants are not joined");
    const project = path.join(root, "project");
    const installed = path.join(project, "node_modules", "entry-descriptor");
    writeGoModule(path.join(project, "go-plugin"));
    write(path.join(project, "package.json"), '{ "private": true }\n');
    write(
      path.join(installed, "package.json"),
      '{ "name": "entry-descriptor", "main": "index.cjs" }\n',
    );
    write(
      path.join(installed, "index.cjs"),
      [
        'const path = require("node:path");',
        "module.exports = (context) => ({ name: 'entry-descriptor', source: path.join(context.projectRoot, 'go-plugin') });",
        "",
      ].join("\n"),
    );
    write(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: "entry-descriptor" }] },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });

    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      env: {
        ...process.env,
        TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
        TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
      },
      tsconfig: path.join(project, "tsconfig.json"),
    });

    const entry = physical(path.join(installed, "index.cjs"));
    assert.ok(
      loaded.hostInputs.some(
        (input) =>
          physical(input) === entry &&
          Object.prototype.hasOwnProperty.call(loaded.hostInputHashes, input),
      ),
      "the installed entry is a proven input",
    );
    const projectModules = physical(path.join(project, "node_modules"));
    const farther = loaded.hostInputs.filter(
      (input) =>
        input.includes(path.join("node_modules", "entry-descriptor")) &&
        !physical(input).startsWith(projectModules + path.sep),
    );
    assert.deepEqual(farther, [], "no candidate past the selected search root");
  };

/** The path's physical spelling, or its own for a path that does not exist. */
function physical(file: string): string {
  try {
    return fs.realpathSync.native(file);
  } catch (error) {
    if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? ""))
      throw error;
    const parent = path.dirname(file);
    if (parent === file) throw error;
    return path.join(physical(parent), path.basename(file));
  }
}

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
