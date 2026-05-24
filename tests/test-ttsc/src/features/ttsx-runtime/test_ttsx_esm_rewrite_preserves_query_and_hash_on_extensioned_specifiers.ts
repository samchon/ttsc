import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx ESM rewrite preserves query and hash on extensioned specifiers.
 *
 * The extension rewriter must inspect the path portion before deciding whether
 * a specifier already has `.js`. Otherwise `./helper.js?x` can be rewritten as
 * `./helper.js?x.js`, which still loads but changes `import.meta.url` and
 * module identity for loaders that use query or hash suffixes.
 *
 * 1. Create an ESM project that dynamically imports `./helper.js?query` and
 *    `./helper.js#hash`.
 * 2. Run ttsx against the entry.
 * 3. Assert the imported module sees the original query and hash suffixes.
 */
export const test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/helper.ts": `export const href: string = import.meta.url;\n`,
      "src/import-url-suffixes.d.ts": [
        `declare module "*?query" { export const href: string; }`,
        `declare module "*#hash" { export const href: string; }`,
        ``,
      ].join("\n"),
      "src/main.ts": `
        export {};
        const query = await import("./helper.js?query");
        const hash = await import("./helper.js#hash");
        console.log(JSON.stringify({
          query: new URL(query.href).search,
          hash: new URL(hash.href).hash,
        }));
      `,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      query: "?query",
      hash: "#hash",
    });
  };
