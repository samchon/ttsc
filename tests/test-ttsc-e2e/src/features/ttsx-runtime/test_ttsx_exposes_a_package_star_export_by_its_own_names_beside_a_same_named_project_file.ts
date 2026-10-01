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
 * 1. Create an ES module project that emits `src/inner.ts`, and install a CommonJS
 *    source package whose entry does `export * from "./inner"` over a different
 *    `src/inner.ts`.
 * 2. Run an entry that imports the package's name through a named import.
 * 3. Assert the package's own value arrives.
 * @evidence contracts/testing.md#behavioral-verification Ttsx must print project:package when ESM main imports its projectOnly value and the CommonJS package star-reexported packageValue from different src/inner.ts files.
 * @evidence contracts/testing.md#independent-expectations Distinct authored project/package export names and values make a wrong same-name output lookup fail independently of ownership metadata.
 * @evidence contracts/testing.md#distinguishing-cases The same relative file spelling occurs under two owners with different export sets; package export-star named import crosses the CommonJS-to-ESM facade.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_exposes_a_package_star_export_by_its_own_names_beside_a_same_named_project_file entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Native package emit, star-name discovery and Node named-import linking must agree on the target-owned output. Direct ownership-index/source-metadata units cannot establish the live facade connection.
 * @evidence contracts/e2e.md#shared-execution One immutable collision graph and one ESM host retain the project build and package preparation. Both competing sources coexist; no per-export installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The two inner files stay immutable and distinct in the same fixture. Synchronous host exit releases runtime owners and TestProject releases tracked directories.
 * @evidence contracts/e2e.md#preserved-coverage Original zero exit and exact project:package remain. The collision and named-import provenance are actual assembly assertions, not inferred from similar unit filenames.
 */
export function test_ttsx_exposes_a_package_star_export_by_its_own_names_beside_a_same_named_project_file() {
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
  }
