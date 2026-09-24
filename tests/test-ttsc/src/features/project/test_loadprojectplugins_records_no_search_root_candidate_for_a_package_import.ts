import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

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
 * 1. For the CommonJS evaluator and the ttsx evaluator, write a project whose
 *    package maps `#dep` to a file, and whose descriptor imports `#dep`.
 * 2. Load the project's plugins.
 * 3. Assert the mapped file and the manifest are proven inputs, and no input names
 *    `#dep` below a `node_modules`.
 */
export const test_loadprojectplugins_records_no_search_root_candidate_for_a_package_import =
  () => {
    for (const format of ["cjs", "ts"] as const) {
      const root = TestProject.tmpdir(
        `ttsc-descriptor-package-import-${format}-`,
      );
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
    }
  };

/** The path's physical spelling, or its own for a path that does not exist. */
function physical(file: string): string {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return path.join(physical(path.dirname(file)), path.basename(file));
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
