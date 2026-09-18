import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx exposes a CommonJS source package's `export *` names from the
 * re-exported file itself when the entry project emitted a file of the same
 * name.
 *
 * An ESM import of a CommonJS module sees only the names Node's lexer can find,
 * so ttsx scans each star re-export target for them. The scan reads the output
 * a build emitted for that target, and it used to ask the same name-scoring
 * lookup the loader did: a package's `src/inner.ts` found the project's own
 * `src/inner.js`, an ES module with no CommonJS assignments, and the package's
 * names vanished from the named-import bridge (samchon/ttsc#1382). The scan now
 * reads only output proven to come from the target, and falls back to an
 * isolated emit of the target itself.
 *
 * 1. Create an ES module project that emits `src/inner.ts`, and install a
 *    CommonJS source package whose entry does `export * from "./inner"` over a
 *    different `src/inner.ts`.
 * 2. Run an entry that imports the package's name through a named import.
 * 3. Assert the package's own value arrives.
 */
export const test_ttsx_exposes_a_package_star_export_by_its_own_names_beside_a_same_named_project_file =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          types: [],
        },
        include: ["src"],
      }),
      "src/inner.ts": `export const projectOnly: string = "project";\n`,
      "src/main.ts": [
        `import { projectOnly } from "./inner.js";`,
        `import { packageValue } from "lib";`,
        `console.log(projectOnly + ":" + packageValue);`,
        ``,
      ].join("\n"),
      "node_modules/lib/package.json": JSON.stringify({
        name: "lib",
        version: "1.0.0",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/lib/src/index.ts": `export * from "./inner";\n`,
      "node_modules/lib/src/inner.ts": `export const packageValue: string = "package";\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "project:package");
  };
