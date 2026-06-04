import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx lowers a CommonJS-classified raw dependency that is authored
 * with ECMAScript module syntax (`export const`/`export function`/`export
 * namespace`) all the way to CommonJS, instead of only stripping its types.
 *
 * A published dependency that ships raw `.ts` straight under `node_modules` has
 * no owning tsconfig, so ttsx transforms the lone file. Node's in-process
 * `stripTypeScriptTypes` erases types but never rewrites `import`/`export` into
 * CommonJS. For a file classified CommonJS (a `.cts`, or a `.ts` in a package
 * without `type: "module"` under NodeNext) authored with module syntax, the
 * surviving `export` made Node's CommonJS loader throw `SyntaxError: Unexpected
 * token 'export'`. The orphan-file path must instead run a real tsgo `--module
 * commonjs` emit so the module syntax becomes `module.exports`. This is the
 * regression twin of `..._with_no_module_syntax_as_commonjs`, which only needs
 * type-stripping because it never carries an `export`.
 *
 * 1. Install a `cjs-dep` with no `type` field (so its `.ts` is CommonJS under
 *    NodeNext) whose entry uses `export const`, `export function`, and `export
 *    namespace`.
 * 2. Run ttsx against a NodeNext consumer that imports the dependency.
 * 3. Assert the dependency loaded and every exported member produced its value.
 */
export const test_ttsx_lowers_a_commonjs_dependency_with_module_syntax_to_commonjs =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          esModuleInterop: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      // No `type` field: under NodeNext a `.ts` here is authoritatively
      // CommonJS, yet it is authored with ECMAScript `export` syntax.
      "node_modules/cjs-dep/package.json": JSON.stringify({
        name: "cjs-dep",
        version: "1.0.0",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/cjs-dep/index.ts":
        "export const answer: number = 42;\n" +
        "export function shout(text: string): string {\n" +
        "  return text.toUpperCase();\n" +
        "}\n" +
        "export namespace Box {\n" +
        "  export const value: number = 7;\n" +
        "}\n",
      "src/main.ts":
        `import dep from "cjs-dep";\n` +
        "console.log(`${dep.answer}:${dep.shout('ok')}:${dep.Box.value}`);\n",
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "42:OK:7");
  };
