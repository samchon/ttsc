import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies an unset `module` option from the target, not from
 * the package type.
 *
 * Pins the `module`-absent branch of `runtimeHooks.ts::effectiveModuleKind`.
 * tsgo derives the emit kind from `target` when `module` is missing, and
 * TypeScript 7 defaults `target` to the latest standard, so this project emits
 * ES modules. The classifier used to read the absent option as "ask the nearest
 * package.json", answered CommonJS, and Node died on the emitted `export`
 * before the entry ran — in the single most ordinary project shape there is.
 *
 * 1. Create a project with no `module` and no `target`, in a package with no
 *    `"type"` field.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert the run succeeds and the imported binding arrived.
 */
export const test_ttsx_classifies_an_unset_module_option_from_the_target =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "unset-module",
        version: "1.0.0",
      }),
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
  };
