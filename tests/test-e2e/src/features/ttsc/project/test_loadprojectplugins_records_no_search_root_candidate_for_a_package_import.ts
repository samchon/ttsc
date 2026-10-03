import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a descriptor's `#` import records no `node_modules` candidate, while
 * the manifest whose `imports` maps it stays a proven input.
 *
 * Node looks a `#` specifier up in the importer's own package `imports` and in
 * no search root. The ttsx evaluator and the loader's candidate expansion read
 * `#dep` as a package name and recorded `node_modules/#dep` with every
 * extension in every search root up to the volume root, paths Node never reads,
 * each proven absent by the metadata of a directory such as the home directory;
 * the isolated CommonJS evaluator already skipped them.
 *
 * 1. For the cjs and ts descriptor requests, write a project whose
 *    package maps `#dep` to a file, and whose descriptor imports `#dep`.
 * 2. Load the project's plugins.
 * 3. Assert the mapped file and the manifest are proven inputs, and no input names
 *    `#dep` below a `node_modules`.
 *
 * @evidence contracts/testing.md#behavioral-verification Both authored format requests report mapped file and imports manifest proof and no node_modules/#dep candidates; actual selected evaluator is not established merely by suffix.
 * @evidence contracts/testing.md#independent-expectations Package imports resolve #dep from its authored imports map, independently of ordinary node_modules package search.
 * @evidence contracts/testing.md#distinguishing-cases 1. For the cjs and ts descriptor requests, write a project whose package maps `#dep` to a file, and whose descriptor imports `#dep`. 2. Load the project's plugins. 3. Assert the mapped file and the manifest are proven inputs, and no input names `#dep` below a `node_modules`.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls workspace loadProjectPlugins and the actual isolated descriptor return/proof transport. Scripted Go publication is fixture preparation, not real Go compiler or packed-consumer semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution Each authored request uses its own fresh topology/cache and one load with the common scripted Go inventory. No warm hit, avoided preparation, Program reuse or actual child total is asserted; conditional evaluator selection needs actual observation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked roots are retained before preparation. Same-evaluator mutation belongs to its private topology, not a concurrent writer process. Synchronous returned output does not establish descendant join, and physical missing-path expectations propagate permission/other errors.
 * @evidence contracts/e2e.md#preserved-coverage The cjs/ts requests preserve local dep.cjs and package.json proven membership plus empty node_modules/#dep candidates. Typed suffix alone is not actual fallback execution proof; imports to a local file differs from imports to a bare package. Original input bytes/assertions and failure identities remain; runtime/manifest/survival unverified and donor retained.
 */
export const test_loadprojectplugins_records_no_search_root_candidate_for_a_package_import =
  () => {
    const failures: unknown[] = [];
    for (const format of ["cjs", "ts"] as const) {
      try {
        const root = TestProject.tmpdir(
          `ttsc-descriptor-package-import-${format}-`,
        );
        TestProject.retainTemporaryDirectory(root, "Package proof descendants are not joined");
        const project = path.join(root, "project");
        writeGoModule(path.join(project, "go-plugin"));
        write(
          path.join(project, "package.json"),
          JSON.stringify({ private: true, imports: { "#dep": "./dep.cjs" } }),
        );
        write(path.join(project, "dep.cjs"), 'module.exports = "go-plugin";\n');
        write(
          path.join(project, `plugin.${format}`),
          [
            format === "ts"
              ? 'import path = require("node:path");'
              : 'const path = require("node:path");',
            'const source = require("#dep");',
            format === "ts"
              ? "export = (context: { dirname: string }) => ({ name: 'package-import', source: path.join(context.dirname, source) });"
              : "module.exports = (context) => ({ name: 'package-import', source: path.join(context.dirname, source) });",
            "",
          ].join("\n"),
        );
        write(
          path.join(project, "tsconfig.json"),
          JSON.stringify({
            compilerOptions: {
              module: "commonjs",
              plugins: [{ transform: `./plugin.${format}` }],
            },
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

        const proven = (file: string): boolean =>
          loaded.hostInputs.some(
            (input) =>
              physical(input) === physical(file) &&
              Object.prototype.hasOwnProperty.call(loaded.hostInputHashes, input),
          );
        assert.ok(
          proven(path.join(project, "dep.cjs")),
          `${format}: the mapped file is a proven input`,
        );
        assert.ok(
          proven(path.join(project, "package.json")),
          `${format}: the manifest that maps it is a proven input`,
        );
        const searched = loaded.hostInputs.filter((input) =>
          input.includes(path.join("node_modules", "#dep")),
        );
        assert.deepEqual(searched, [], `${format}: no search root candidate`);
      } catch (error) {
        failures.push(new Error(`${format}: package proof`, { cause: error }));
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Package proof profiles failed");
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
