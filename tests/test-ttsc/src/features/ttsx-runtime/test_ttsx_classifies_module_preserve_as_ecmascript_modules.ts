import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies `module: "preserve"` as ECMAScript modules inside a
 * CommonJS package.
 *
 * `preserve` keeps the authored `import`/`export` syntax verbatim — tsgo does
 * not rewrite it for the package type — so the emit is an ES module no matter
 * what the manifest says. The classifier used to route `preserve` to the
 * nearest `package.json` alongside the `node*` family, answered CommonJS in a
 * package with no `"type"`, and Node failed to find the named export in what it
 * was told was a CommonJS module.
 *
 * 1. Create a `module: "preserve"` project in a package with no `"type"`.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert the run succeeds and the imported binding arrived.
 */
export const test_ttsx_classifies_module_preserve_as_ecmascript_modules =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "preserve", version: "1.0.0" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "preserve",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/dep.ts": `export const dep: string = "preserve-stays-esm";\n`,
      "src/main.ts": `import { dep } from "./dep";\nconsole.log(dep);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "preserve-stays-esm");
  };
