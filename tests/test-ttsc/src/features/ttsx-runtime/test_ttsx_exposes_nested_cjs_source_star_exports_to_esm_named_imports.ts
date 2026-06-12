import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx exposes nested `export *` names from a CommonJS-classified
 * source package to an ESM consumer's named import.
 *
 * A source-shipping package with no `type` field is CommonJS under Node's
 * package rules, but TypeScript authors still commonly write its source with
 * ESM `export *` syntax. tsgo lowers that star export to a dynamic CommonJS
 * helper that CJS consumers can read, while Node's ESM linker cannot statically
 * discover the re-exported names. ttsx must keep the CommonJS runtime path and
 * still make those names visible to the ESM named-import bridge.
 *
 * 1. Install a `lib` package with no `type` field whose TS entry re-exports value
 *    names through a nested `export *` chain.
 * 2. Run an ESM ttsx entry that imports `{ foo, bar }` from `lib`.
 * 3. Run a CJS ttsx entry that requires the same `lib` package.
 * 4. Assert both module formats observe the re-exported runtime values.
 */
export const test_ttsx_exposes_nested_cjs_source_star_exports_to_esm_named_imports =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          esModuleInterop: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/lib/package.json": JSON.stringify({
        name: "lib",
        version: "1.0.0",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/lib/src/index.ts": `export * from "./middle";\n`,
      "node_modules/lib/src/middle.ts": [
        `export * from "./inner";`,
        `export * as grouped from "./leaf";`,
        ``,
      ].join("\n"),
      "node_modules/lib/src/inner.ts": [
        `export type Hidden = string;`,
        `// export const commentedGhost: string = "nope";`,
        `const decoy: string = "export const stringGhost: string = 'nope';";`,
        `const renamed: string = "renamed-ok";`,
        `export const foo: string = "foo-ok";`,
        `export function bar(): string {`,
        `  return "bar-ok";`,
        `}`,
        `export { renamed as qux };`,
        ``,
      ].join("\n"),
      "node_modules/lib/src/leaf.ts": `export const leaf: string = "leaf-ok";\n`,
      "src/main.ts": [
        `import { foo, bar, qux, grouped } from "lib";`,
        `import * as lib from "lib";`,
        `if ("Hidden" in lib) throw new Error("type-only export leaked");`,
        `if ("commentedGhost" in lib) throw new Error("comment export leaked");`,
        `if ("stringGhost" in lib) throw new Error("string export leaked");`,
        `console.log(foo + ":" + bar() + ":" + qux + ":" + grouped.leaf);`,
        ``,
      ].join("\n"),
      "src/require.cts": [
        `declare const require: (specifier: "lib") => typeof import("lib");`,
        `const lib = require("lib");`,
        `if ("Hidden" in lib) throw new Error("type-only export leaked");`,
        `if ("commentedGhost" in lib) throw new Error("comment export leaked");`,
        `if ("stringGhost" in lib) throw new Error("string export leaked");`,
        `console.log(lib.foo + ":" + lib.bar() + ":" + lib.qux + ":" + lib.grouped.leaf);`,
        ``,
      ].join("\n"),
    });

    const esm = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(esm.status, 0, esm.stderr);
    assert.equal(esm.stdout.trim(), "foo-ok:bar-ok:renamed-ok:leaf-ok");

    const cjs = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/require.cts"],
      { cwd: root },
    );
    assert.equal(cjs.status, 0, cjs.stderr);
    assert.equal(cjs.stdout.trim(), "foo-ok:bar-ok:renamed-ok:leaf-ok");
  };
