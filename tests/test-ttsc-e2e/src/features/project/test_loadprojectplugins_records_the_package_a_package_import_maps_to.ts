import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a descriptor's `#` import that its package's `imports` maps to a
 * bare package records that package's candidates in every search root up to the
 * one it resolved in, and none past it.
 *
 * Node resolves the target of such a mapping through the ordinary
 * `node_modules` search from the importer. A nearer copy of the package, a
 * nested install or a moved workspace package, would be selected instead, so
 * the nearer candidates the lookup found missing are inputs of the descriptor.
 * Every descriptor evaluator stopped at the `#` and recorded none of them, so a
 * nearer package appearing later left the cached descriptor proven for a state
 * that no longer held (samchon/ttsc#1498).
 *
 * 1. For the CommonJS evaluator and the ttsx evaluator, write a workspace whose
 *    app package maps `#dep` to a package hoisted to the workspace root, once
 *    by name and once as a scoped package's subpath, and once to a package
 *    installed in the app itself.
 * 2. Load the app's plugins.
 * 3. Assert the candidates of the app's own `node_modules` are proven inputs for a
 *    hoisted package, the selected module is a proven input, and no candidate
 *    lies past the root the package resolved in; then create the nearer package
 *    and assert a recorded input no longer matches.
 *
 * @evidence contracts/testing.md#behavioral-verification Bare and scoped-subpath #import targets record nearer candidates and selected files, omit farther roots, and detect later nearer-package creation.
 * @evidence contracts/testing.md#independent-expectations Authored imports mappings and package locations establish which ordinary Node candidates can supersede the selected module.
 * @evidence contracts/testing.md#distinguishing-cases 1. For the CommonJS evaluator and the ttsx evaluator, write a workspace whose app package maps `#dep` to a package hoisted to the workspace root, once by name and once as a scoped package's subpath, and once to a package installed in the app itself. 2. Load the app's plugins. 3. Assert the candidates of the app's own `node_modules` are proven inputs for a hoisted package, the selected module is a proven input, and no candidate lies past the root the package resolved in; then create the nearer package and assert a recorded input no longer matches.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Bare and scoped-subpath #import targets record nearer candidates and selected files, omit farther roots, and detect later nearer-package creation. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_records_the_package_a_package_import_maps_to =
  () => {
    for (const format of ["cjs", "ts"] as const)
      for (const layout of [
        { hoisted: true, packageName: "selection", target: "selection" },
        {
          hoisted: true,
          packageName: "@scope/selection",
          target: "@scope/selection/sub.js",
        },
        { hoisted: false, packageName: "selection", target: "selection" },
      ]) {
        const label = `${format} ${layout.target}${layout.hoisted ? " hoisted" : ""}`;
        const root = TestProject.tmpdir(`ttsc-descriptor-mapped-${format}-`);
        const app = path.join(root, "packages", "app");
        const installRoot = layout.hoisted ? root : app;
        const installed = path.join(
          installRoot,
          "node_modules",
          ...layout.packageName.split("/"),
        );
        const nearer = path.join(
          app,
          "node_modules",
          ...layout.packageName.split("/"),
        );
        writeGoModule(path.join(app, "go-plugin"));
        write(path.join(root, "package.json"), '{ "private": true }\n');
        write(
          path.join(app, "package.json"),
          JSON.stringify({ private: true, imports: { "#dep": layout.target } }),
        );
        fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
        write(
          path.join(installed, "package.json"),
          JSON.stringify({ main: "index.js", name: layout.packageName }),
        );
        write(
          path.join(installed, "index.js"),
          'module.exports = "go-plugin";\n',
        );
        write(
          path.join(installed, "sub.js"),
          'module.exports = "go-plugin";\n',
        );
        write(
          path.join(app, `plugin.${format}`),
          [
            format === "ts"
              ? 'import path = require("node:path");'
              : 'const path = require("node:path");',
            'const source = require("#dep");',
            format === "ts"
              ? "export = (context: { dirname: string }) => ({ name: 'mapped', source: path.join(context.dirname, source) });"
              : "module.exports = (context) => ({ name: 'mapped', source: path.join(context.dirname, source) });",
            "",
          ].join("\n"),
        );
        write(
          path.join(app, "tsconfig.json"),
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
          cwd: app,
          env: {
            ...process.env,
            TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
            TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
          },
          tsconfig: path.join(app, "tsconfig.json"),
        });

        const recorded = (file: string): string | undefined =>
          loaded.hostInputs.find((input) => physical(input) === physical(file));
        const proven = (file: string): boolean => {
          const input = recorded(file);
          return (
            input !== undefined &&
            Object.prototype.hasOwnProperty.call(loaded.hostInputHashes, input)
          );
        };
        const selectedModule = path.join(
          installed,
          layout.target.endsWith("sub.js") ? "sub.js" : "index.js",
        );
        assert.ok(
          proven(selectedModule),
          `${label}: the selected module is a proven input`,
        );
        const outside = loaded.hostInputs.filter(
          (input) =>
            input.includes(
              path.join("node_modules", ...layout.packageName.split("/")),
            ) && !isBelow(input, installRoot),
        );
        assert.deepEqual(
          outside,
          [],
          `${label}: no candidate past the root the package resolved in`,
        );
        if (!layout.hoisted) continue;

        const nearerManifest = path.join(nearer, "package.json");
        assert.ok(
          proven(nearerManifest),
          `${label}: the nearer package's manifest is a proven input`,
        );
        assert.equal(
          loaded.hostInputHashes[recorded(nearerManifest)!],
          null,
          `${label}: the nearer package is recorded missing`,
        );
        write(
          nearerManifest,
          JSON.stringify({ main: "index.js", name: layout.packageName }),
        );
        write(path.join(nearer, "index.js"), 'module.exports = "go-plugin";\n');
        assert.ok(
          fs.existsSync(recorded(nearerManifest)!),
          `${label}: the nearer package moves a recorded input`,
        );
      }
  };

/** Whether a path lies below a directory, compared physically. */
function isBelow(file: string, directory: string): boolean {
  const relative = path.relative(physical(directory), physical(file));
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

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
