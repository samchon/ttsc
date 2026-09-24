import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a plugin descriptor keeps its cache proof when a directory above the
 * project churns while it evaluates, and records no candidate from a search
 * root past the one its package resolved in.
 *
 * A bare specifier is looked up in every `node_modules` from the importer up to
 * the volume root, and the lookup stops at the first root whose package it
 * selects. Both descriptor evaluators fingerprinted every root before the
 * resolver ran, and reported them all. A missing candidate is proven absent by
 * the metadata of its nearest existing ancestor, so `~/node_modules/<package>`
 * was proven by the home directory's metadata, which any process writing a file
 * there moves. The descriptor then lost its proof, and `@ttsc/unplugin` its
 * reusable generation, for a path Node never read. They now report only the
 * roots up to the selected one.
 *
 * 1. For the CommonJS evaluator and the ttsx evaluator, write a project whose
 *    descriptor requires a package installed in the project, and which adds and
 *    removes a directory beside the project while it evaluates.
 * 2. Load the project's plugins.
 * 3. Assert every recorded input carries its proof, and none lies in a search root
 *    past the project's own `node_modules`.
 */
export const test_loadprojectplugins_descriptor_proof_ignores_search_roots_past_the_selected_package =
  () => {
    for (const format of ["cjs", "ts"] as const) {
      const root = TestProject.tmpdir(
        `ttsc-descriptor-search-roots-${format}-`,
      );
      const project = path.join(root, "project");
      const sibling = path.join(root, "sibling");
      writeGoModule(path.join(project, "go-plugin"));
      write(path.join(project, "package.json"), '{ "private": true }\n');
      write(
        path.join(project, "node_modules", "selection", "package.json"),
        '{ "name": "selection", "main": "index.js" }\n',
      );
      write(
        path.join(project, "node_modules", "selection", "index.js"),
        'module.exports = "go-plugin";\n',
      );
      write(
        path.join(project, `plugin.${format}`),
        [
          format === "ts"
            ? 'import fs = require("node:fs");\nimport path = require("node:path");'
            : 'const fs = require("node:fs");\nconst path = require("node:path");',
          'const source = require("selection");',
          // Another process writing beside the project, as one writes in a home
          // directory, while the descriptor evaluates.
          `fs.mkdirSync(${JSON.stringify(sibling)});`,
          `fs.rmdirSync(${JSON.stringify(sibling)});`,
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

      const installed = physical(
        path.join(project, "node_modules", "selection", "index.js"),
      );
      assert.ok(
        loaded.hostInputs.some((input) => physical(input) === installed),
        `${format}: the selected package is an input`,
      );
      const unproven = loaded.hostInputs.filter(
        (input) =>
          !Object.prototype.hasOwnProperty.call(loaded.hostInputHashes, input),
      );
      assert.deepEqual(unproven, [], `${format}: every input keeps its proof`);
      const projectModules = physical(path.join(project, "node_modules"));
      const farther = loaded.hostInputs.filter(
        (input) =>
          input.includes(path.join("node_modules", "selection")) &&
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
