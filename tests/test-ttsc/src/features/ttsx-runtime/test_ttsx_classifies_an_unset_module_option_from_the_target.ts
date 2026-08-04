import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies an unset `module` option from the target, not from
 * the package type — including when the package states CommonJS outright.
 *
 * Pins the `module`-absent branch of `runtimeHooks.ts::effectiveModuleKind`.
 * tsgo derives the emit kind from `target` when `module` is missing, and every
 * target TypeScript 7 still accepts is ES2015 or later, so such a project emits
 * ES modules whatever the manifest says. The classifier used to read the absent
 * option as "ask the nearest package.json", answered CommonJS, and Node died on
 * the emitted `export` before the entry ran — in the single most ordinary
 * project shape there is.
 *
 * The `"type": "commonjs"` half is the twin that makes this about the
 * derivation rather than about a missing manifest: an explicit CommonJS
 * declaration must still lose to the project's own compiler options.
 *
 * 1. Create two projects with no `module`, one in a package with no `"type"` and
 *    one that declares `"type": "commonjs"`.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert both runs succeed and the imported binding arrived.
 */
export const test_ttsx_classifies_an_unset_module_option_from_the_target =
  () => {
    for (const [label, manifest] of [
      ["silent", { name: "unset-module", version: "1.0.0" }],
      [
        "declared",
        { name: "unset-module-cjs", version: "1.0.0", type: "commonjs" },
      ],
    ] as const) {
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
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "derived-from-target", label);
    }
  };
