import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a plugin descriptor loses its cache proof for a nearer copy of the
 * package its `#` import maps to, when that copy appears and disappears while
 * the descriptor evaluates.
 *
 * A package's `imports` may map a `#` specifier to a bare package, which Node
 * looks up through the ordinary `node_modules` search from the importer. The
 * candidates of the roots nearer than the one that selected it were read, so
 * their absence is part of what the descriptor's result depends on, and it is
 * proven by the metadata of their nearest existing ancestor
 * (samchon/ttsc#1498). This is the negative twin of recording those roots: a
 * nearer package that came and went must leave them without proof.
 *
 * 1. For the CommonJS evaluator and the ttsx evaluator, write a workspace whose
 *    project maps `#dep` to a package hoisted one directory above it, and whose
 *    descriptor creates and removes that package in the project's own
 *    `node_modules` after it imports `#dep`.
 * 2. Load the project's plugins.
 * 3. Assert the nearer candidates are inputs without proof, while the selected
 *    package keeps its proof, and no candidate past its root is an input.
 */
export const test_loadprojectplugins_package_import_proof_refuses_a_nearer_package_that_came_and_went =
  () => {
    for (const format of ["cjs", "ts"] as const) {
      const root = TestProject.tmpdir(
        `ttsc-descriptor-import-nearer-${format}-`,
      );
      const project = path.join(root, "project");
      const nearer = path.join(project, "node_modules", "selection");
      writeGoModule(path.join(project, "go-plugin"));
      write(path.join(root, "package.json"), '{ "private": true }\n');
      write(
        path.join(project, "package.json"),
        JSON.stringify({ private: true, imports: { "#dep": "selection" } }),
      );
      fs.mkdirSync(path.join(project, "node_modules"));
      write(
        path.join(root, "node_modules", "selection", "package.json"),
        '{ "name": "selection", "main": "index.js" }\n',
      );
      write(
        path.join(root, "node_modules", "selection", "index.js"),
        'module.exports = "go-plugin";\n',
      );
      write(
        path.join(project, `plugin.${format}`),
        [
          format === "ts"
            ? 'import fs = require("node:fs");\nimport path = require("node:path");'
            : 'const fs = require("node:fs");\nconst path = require("node:path");',
          'const source = require("#dep");',
          `fs.mkdirSync(${JSON.stringify(nearer)});`,
          `fs.rmdirSync(${JSON.stringify(nearer)});`,
          format === "ts"
            ? "export = (context: { dirname: string }) => ({ name: 'selection', source: path.join(context.dirname, source) });"
            : "module.exports = (context) => ({ name: 'selection', source: path.join(context.dirname, source) });",
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
      const recorded = (file: string): boolean =>
        loaded.hostInputs.some((input) => physical(input) === physical(file));
      assert.ok(
        recorded(nearer),
        `${format}: the nearer candidate is an input`,
      );
      assert.equal(
        proven(nearer),
        false,
        `${format}: a nearer candidate that came and went keeps no proof`,
      );
      assert.equal(
        proven(path.join(root, "node_modules", "selection", "index.js")),
        true,
        `${format}: the selected package keeps its proof`,
      );
      const selectedRoot = physical(path.join(root, "node_modules"));
      const projectModules = physical(path.join(project, "node_modules"));
      const farther = loaded.hostInputs.filter(
        (input) =>
          input.includes(path.join("node_modules", "selection")) &&
          !physical(input).startsWith(selectedRoot + path.sep) &&
          !physical(input).startsWith(projectModules + path.sep),
      );
      assert.deepEqual(
        farther,
        [],
        `${format}: no candidate past the selected search root`,
      );
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
