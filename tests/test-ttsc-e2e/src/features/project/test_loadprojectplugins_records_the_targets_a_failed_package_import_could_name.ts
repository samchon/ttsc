import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a descriptor's failed `#` import records every target it could have
 * resolved to, so the target appearing later invalidates the descriptor.
 *
 * A descriptor may catch a failed `#` import and fall back to another value.
 * The failed resolution names no module, and the recorder committed nothing for
 * it, so neither the relative file the package's `imports` maps the specifier
 * to nor the bare package it maps another to was an input. Creating either
 * later changed what the descriptor returns while its cached record still
 * matched (samchon/ttsc#1547).
 *
 * 1. For the CommonJS evaluator and the ttsx evaluator, map `#opt` to a missing
 *    file and `#pkg` to a missing package, and catch both imports in the
 *    descriptor.
 * 2. Load the project's plugins.
 * 3. Assert the missing file and the missing package's manifest candidate are
 *    proven absent inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Caught missing #imports retain proven absence inputs for the mapped relative file and bare-package manifest in both evaluator formats.
 * @evidence contracts/testing.md#independent-expectations The authored imports map names these missing targets even though no module was returned; later creation must change that resolution premise.
 * @evidence contracts/testing.md#distinguishing-cases 1. For the CommonJS evaluator and the ttsx evaluator, map `#opt` to a missing file and `#pkg` to a missing package, and catch both imports in the descriptor. 2. Load the project's plugins. 3. Assert the missing file and the missing package's manifest candidate are proven absent inputs.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Caught missing #imports retain proven absence inputs for the mapped relative file and bare-package manifest in both evaluator formats. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_records_the_targets_a_failed_package_import_could_name =
  () => {
    for (const format of ["cjs", "ts"] as const) {
      const root = TestProject.tmpdir(
        `ttsc-descriptor-failed-import-${format}-`,
      );
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
