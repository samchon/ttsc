import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies `module: "umd"` as CommonJS.
 *
 * The classifier's fallback comment claimed that "es2015 … esnext, system, amd,
 * umd" all emit ECMAScript modules. UMD emits none: its output is a wrapper
 * that publishes through `exports` when one exists, so evaluating it as an ES
 * module leaves `module`/`exports` undefined and the wrapper writes its exports
 * nowhere the importer can see. Node must load it as CommonJS.
 *
 * 1. Create a `module: "umd"` project in a package with no `"type"`.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert the run succeeds and the imported binding arrived.
 */
export const test_ttsx_classifies_module_umd_as_commonjs = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "umd", version: "1.0.0" }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "umd",
        strict: true,
        outDir: "lib",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/dep.ts": `export const dep: string = "umd-commonjs";\n`,
    "src/main.ts": `import { dep } from "./dep";\nconsole.log(dep);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "umd-commonjs");
};
