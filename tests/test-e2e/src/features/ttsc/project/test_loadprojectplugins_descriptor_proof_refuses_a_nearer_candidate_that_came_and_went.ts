import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a plugin descriptor loses its cache proof for a module candidate
 * nearer than the package it resolved, when that candidate appears and
 * disappears while the descriptor evaluates.
 *
 * A bare specifier's lookup reads every search root up to the one whose package
 * it selects. A candidate in a nearer root was read, so its absence is part of
 * what the descriptor's result depends on. This fixture creates an empty
 * candidate directory, not a second valid package or another executed module. Its absence is proven
 * by the metadata of its nearest existing ancestor, which such an appearance
 * moves even when the candidate is gone again by the time anything looks at it
 * by name. This is the negative twin of the evaluators reporting only the roots
 * up to the selected one: the roots they keep keep that proof.
 *
 * 1. For the CommonJS evaluator and the ttsx evaluator, write a project whose
 *    descriptor requires a package installed one directory above the project,
 *    and which creates and removes that package in the project's own
 *    `node_modules` while it evaluates.
 * 2. Load the project's plugins.
 * 3. Assert the nearer candidates are inputs without proof, while the selected
 *    package keeps its proof, and no candidate past its root is an input.
 *
 * @evidence contracts/testing.md#behavioral-verification The cjs and ts descriptor requests record the nearer transient directory without proof, retain selected-package proof and omit farther roots. Typed filename alone does not certify that the conditional ttsx fallback executed.
 * @evidence contracts/testing.md#independent-expectations Authored creation/removal of the nearer empty directory contrasts with unchanged selected-package bytes. Literal recorded/proven booleans and empty farther candidates distinguish withdrawn absence authority; no second valid package execution is claimed.
 * @evidence contracts/testing.md#distinguishing-cases 1. For the CommonJS evaluator and the ttsx evaluator, write a project whose descriptor requires a package installed one directory above the project, and which creates and removes that package in the project's own `node_modules` while it evaluates. 2. Load the project's plugins. 3. Assert the nearer candidates are inputs without proof, while the selected package keeps its proof, and no candidate past its root is an input.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls the workspace loadProjectPlugins owner and its actual isolated descriptor transport. Scripted Go publication is fixture input, not real Go compiler semantics; the two requested formats have separate failure identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution Each format has a fresh private project/cache and one load. Both share the scripted Go preparation pattern, not a proven warm hit, Program reuse or measured child total. Actual conditional fallback selection remains unverified.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each tracked root is retained before preparation. Same-evaluator nearer directory creation/removal is the authored mutation, not a separate writer process. Synchronous returns do not prove arbitrary descendant join; both format failures are collected independently and permission errors cannot become missing-path expectations.
 * @evidence contracts/e2e.md#preserved-coverage Original cjs/ts requests, selected outer package, transient empty nearer directory, recorded true/proven false, selected proven true and farther empty observations remain. Root retention and format error aggregation preserve input/failure ownership; actual runtime/manifest/survival remains unverified.
 */
export const test_loadprojectplugins_descriptor_proof_refuses_a_nearer_candidate_that_came_and_went =
  () => {
    const failures: unknown[] = [];
    for (const format of ["cjs", "ts"] as const) {
      try {
        const root = TestProject.tmpdir(`ttsc-descriptor-nearer-${format}-`);
        TestProject.retainTemporaryDirectory(root, "Descriptor proof descendants are not joined");
        const project = path.join(root, "project");
        const nearer = path.join(project, "node_modules", "selection");
        writeGoModule(path.join(project, "go-plugin"));
        write(path.join(root, "package.json"), '{ "private": true }\n');
        write(path.join(project, "package.json"), '{ "private": true }\n');
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
            'const source = require("selection");',
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
      } catch (error) {
        failures.push(new Error(`${format}: nearer descriptor proof`, { cause: error }));
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Nearer descriptor proof profiles failed");
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
