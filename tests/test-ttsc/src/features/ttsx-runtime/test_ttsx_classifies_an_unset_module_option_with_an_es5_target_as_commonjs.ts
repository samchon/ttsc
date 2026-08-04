import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies an unset `module` option with an ES5 target as
 * CommonJS, even inside a `"type": "module"` package.
 *
 * The negative twin of the target-derived ES-module case. `getEmitModuleKind`
 * maps every target below ES2015 to CommonJS, so tsgo emits `exports` here
 * regardless of the package type. A classifier that consulted the package
 * `"type"` for an absent `module` would answer "module" and Node would throw
 * `ReferenceError: exports is not defined in ES module scope`. Together the two
 * cases pin that the derivation, not the manifest, owns this decision.
 *
 * 1. Create a `"type": "module"` package whose tsconfig sets `target: "ES5"` and
 *    no `module`.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert the run succeeds, proving the CommonJS emit was loaded as CommonJS.
 */
export const test_ttsx_classifies_an_unset_module_option_with_an_es5_target_as_commonjs =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "es5-target",
        version: "1.0.0",
        type: "module",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES5",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/dep.ts": `export var dep = "es5-commonjs";\n`,
      "src/main.ts": `import { dep } from "./dep";\nconsole.log(dep);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "es5-commonjs");
  };
