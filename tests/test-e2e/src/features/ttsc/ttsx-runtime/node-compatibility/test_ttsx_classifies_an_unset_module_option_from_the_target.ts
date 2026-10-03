import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies an unset `module` option from the target, not from
 * the package type ??including when the package states CommonJS outright.
 *
 * Pins the `module`-absent branch of
 * `RuntimeModuleFormat.ts::effectiveModuleKind`. tsgo derives the emit kind
 * from `target` when `module` is missing, and every target TypeScript 7 still
 * accepts is ES2015 or later, so such a project emits ES modules whatever the
 * manifest says. The classifier used to read the absent option as "ask the
 * nearest package.json", answered CommonJS, and Node died on the emitted
 * `export` before the entry ran ??in the single most ordinary project shape
 * there is.
 *
 * The `"type": "commonjs"` half is the twin that makes this about the
 * derivation rather than about a missing manifest: an explicit CommonJS
 * declaration must still lose to the project's own compiler options.
 *
 * 1. Create a project with no module/target option in an explicitly CommonJS package.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert the emit/host connection succeeds; cover both manifest types directly in the classifier unit.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual compiler-backed ttsx executes a named sibling import with no configured module/target despite the explicit CommonJS package, asserting zero exit and derived-from-target output.
 * @evidence contracts/testing.md#independent-expectations The supported compiler default emits ES modules for its supported target, so a project-owned implicit module kind overrides a conflicting package declaration; the authored binding independently defines the literal output.
 * @evidence contracts/testing.md#distinguishing-cases The explicit CommonJS package is the contrary-input boundary that must still execute ESM emit; absent and explicit package types, implicit and explicit none module, and supported targets are independently asserted in the actual RuntimeModuleFormat source unit.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry runs one actual native compiler and Node hook session; the portable package/option Cartesian matrix runs through the authored classifier in the unit population.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler's default emit syntax and the hook-selected Node module handler must agree when the manifest disagrees; classifier return values alone cannot prove that emit/host assembly.
 * @evidence contracts/e2e.md#shared-execution One contrary-manifest project preserves the essential default-emit connection. The former silent and explicit manifests have the same effective emit and classification result, so their decision difference executes directly in the source unit rather than repeating compiler preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One fresh immutable fixture explicitly declares CommonJS and omits module/target options; synchronous spawn completes before fixture cleanup, with no cold-to-warm transition being claimed.
 * @evidence contracts/e2e.md#preserved-coverage Original successful-exit and named-binding output assertions remain for the stronger explicit-conflict manifest; both former manifest expectations retain exact classifier results in test_runtime_module_format_preserves_extension_package_and_option_precedence.
 */
export function test_ttsx_classifies_an_unset_module_option_from_the_target() {
    const manifest = { name: "unset-module-cjs", version: "1.0.0", type: "commonjs" };
      const root = TestProject.createProject({
        "package.json": JSON.stringify(manifest),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            strict: true,
            outDir: "lib",
            rootDir: "src",
          },
          include: ["src"],
        }),
        "src/dep.ts": `export const dep: string = "derived-from-target";\n`,
        "src/main.ts": `import { dep } from "./dep";\nconsole.log(dep);\n`,
      });

      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "derived-from-target");
  }
