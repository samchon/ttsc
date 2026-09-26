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
