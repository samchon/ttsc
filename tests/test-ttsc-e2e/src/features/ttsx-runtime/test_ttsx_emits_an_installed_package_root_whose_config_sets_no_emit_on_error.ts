import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx still compiles an installed package's root through the
 * package's own options when that config sets `noEmitOnError` and the root has
 * a type error.
 *
 * An emit-only build fails only when it wrote no JavaScript, so a diagnostic
 * must never withhold the emit. The root inherits every option of its owning
 * project, and an inherited `noEmitOnError: true` would turn the package's own
 * type error into an empty output. The runtime would then fall back to
 * compiling the file with no project at all, and the package's options would
 * silently stop applying. The legacy decorator's argument count pins that they
 * still apply: `experimentalDecorators` passes three arguments to a method
 * decorator, where standard decorators pass two.
 *
 * 1. Install a package with `noEmitOnError: true` and `experimentalDecorators`
 *    whose `main` is a root outside its `include`, carrying a type error and a
 *    legacy method decorator.
 * 2. Run a consumer entry that requires the package.
 * 3. Assert the program observes the legacy decorator's three arguments.
 * @evidence contracts/testing.md#behavioral-verification Ttsx requires strict-pkg/index.ts excluded by include, with noEmitOnError:true, a type error and a legacy method decorator; it must still print arguments=3 successfully.
 * @evidence contracts/testing.md#independent-expectations Foreign errors cannot withhold dependency-lane JavaScript, and the legacy three-argument call independently proves its project options were not lost to isolated fallback.
 * @evidence contracts/testing.md#distinguishing-cases This case adds noEmitOnError to the excluded erroneous package root, beyond its adjacent emit-only sibling. Consumer own-source checking is a different required negative.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary The actual compiler must override the emit-withholding gate while preserving decorator options and serve that output to Node. Direct option normalization cannot prove emitted code remains available.
 * @evidence contracts/e2e.md#shared-execution One fixture and host retain package program plus excluded-root inputs. The similar no-noEmitOnError consumer remains duplicated; this tag does not claim their preparations are already batched.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable package graph belongs to TestProject and the synchronous host owns its runtime generation. No cache mutation or cold-build transition is asserted.
 * @evidence contracts/e2e.md#preserved-coverage Original status zero and exact arguments=3 remain. NoEmitOnError suppression and decorator-option inheritance both remain observable in the same consumer.
 */
export function test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "consumer", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { decoratorArguments: number };`,
        `console.log("arguments=" + require("strict-pkg").decoratorArguments);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/strict-pkg/package.json": JSON.stringify({
        name: "strict-pkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/strict-pkg/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmitOnError: true,
          experimentalDecorators: true,
          types: [],
        },
        include: ["src"],
      }),
      "node_modules/strict-pkg/src/inside.ts": `export const inside: string = "inside";\n`,
      "node_modules/strict-pkg/index.ts": [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `const unchecked: number = "only this package's config reports it";`,
        `export const decoratorArguments: number = observed;`,
        `export const box: Box = new Box();`,
        `export const ignored: number = unchecked;`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "arguments=3");
  }
