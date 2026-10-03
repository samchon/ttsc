import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../../internal/ttsc/internal/project";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a descriptor's failed `#` import records every target it could have
 * resolved to, preserving the missing target as an input; later invalidation is not executed here.
 *
 * A descriptor may catch a failed `#` import and fall back to another value.
 * The failed resolution names no module, and the recorder committed nothing for
 * it, so neither the relative file the package's `imports` maps the specifier
 * to nor the bare package it maps another to was an input. Creating either
 * later changed what the descriptor returns while its cached record still
 * matched (samchon/ttsc#1547).
 *
 * 1. For the cjs and ts descriptor requests, map `#opt` to a missing
 *    file and `#pkg` to a missing package, and catch both imports in the
 *    descriptor.
 * 2. Load the project's plugins.
 * 3. Assert the missing file and the missing package's manifest candidate are
 *    proven absent inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Both cjs/ts requests retain caught missing #opt/#pkg and exact optional.cjs/optional-package manifest membership with null hashes. No target creation or changed later result is asserted.
 * @evidence contracts/testing.md#independent-expectations The authored imports map names these missing targets even though no module was returned; later creation must change that resolution premise.
 * @evidence contracts/testing.md#distinguishing-cases 1. For the cjs and ts descriptor requests, map `#opt` to a missing file and `#pkg` to a missing package, and catch both imports in the descriptor. 2. Load the project's plugins. 3. Assert the missing file and the missing package's manifest candidate are proven absent inputs.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner invokes actual isolated descriptor resolution/proof transport through workspace loadProjectPlugins. Requested typed format is not observed conditional fallback; scripted Go publication is not real compiler or packed-consumer semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution Each format/topology has its own fresh root/cache and one load with the common scripted Go inventory. Independent row failures are collected; request count is not process/Program count or a proven cache hit. No post-creation second load is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked roots are retained before preparation. Existing physical expectations use only ENOENT/ENOTDIR ancestor fallback, preserving other errors. All authored edits are row-owned; returned synchronous results do not establish arbitrary descendant join before later reset.
 * @evidence contracts/e2e.md#preserved-coverage Both cjs/ts requests retain caught missing #opt/#pkg and exact optional.cjs/optional-package manifest membership with null hashes. No target creation or changed later result is asserted. Original input bytes/assertions remain; actual runtime/manifest/survival unverified and donor retained.
 */
export const test_loadprojectplugins_records_the_targets_a_failed_package_import_could_name =
  () => {
    const failures: unknown[] = [];
    for (const format of ["cjs", "ts"] as const) {
      try {
        const root = TestProject.tmpdir(
          `ttsc-descriptor-failed-import-${format}-`,
        );
        TestProject.retainTemporaryDirectory(root, "Failed import descendants are not joined");
        const project = path.join(root, "project");
        writeGoModule(path.join(project, "go-plugin"));
        write(
          path.join(project, "package.json"),
          JSON.stringify({
            private: true,
            imports: {
              "#opt": { node: "./optional.cjs", default: "./optional.cjs" },
              "#pkg": "optional-package",
            },
          }),
        );
        write(
          path.join(project, `plugin.${format}`),
          [
            format === "ts"
              ? "declare const require: (id: string) => unknown;"
              : "",
            "let source = 'go-plugin';",
            "try { require('#opt'); source = 'optional'; } catch {}",
            "try { require('#pkg'); source = 'package'; } catch {}",
            format === "ts"
              ? "export = (context: { dirname: string }) => ({ name: 'failed-import', source: context.dirname + '/' + source });"
              : "module.exports = (context) => ({ name: 'failed-import', source: context.dirname + '/' + source });",
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

        const provenAbsent = (file: string): boolean =>
          loaded.hostInputs.some(
            (input) =>
              physical(input) === physical(file) &&
              Object.prototype.hasOwnProperty.call(
                loaded.hostInputHashes,
                input,
              ) &&
              loaded.hostInputHashes[input] === null,
          );
        assert.ok(
          provenAbsent(path.join(project, "optional.cjs")),
          `${format}: the missing relative target is a proven absent input`,
        );
        assert.ok(
          provenAbsent(
            path.join(
              project,
              "node_modules",
              "optional-package",
              "package.json",
            ),
          ),
          `${format}: the missing package target is a proven absent input`,
        );
      } catch (error) {
        failures.push(new Error(format, { cause: error }));
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Package import outcome profiles failed");
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
