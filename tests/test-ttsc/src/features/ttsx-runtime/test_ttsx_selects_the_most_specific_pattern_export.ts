import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx selects the most specific `*` pattern `exports` entry, matching
 * Node, when rescuing a `.js` pattern target to its `.ts` source.
 *
 * Node chooses the pattern with the longest matching prefix regardless of key
 * order, so a generic `./*` never shadows a more specific `./feature/*`. ttsx
 * re-derives the pattern target when the published `.js` is missing, so a
 * first-match-wins implementation would resolve the wrong source whenever a
 * broader pattern is listed first.
 *
 * 1. Install a dependency whose `exports` lists a generic `./*` before a more
 *    specific `./feature/*`, both mapping to unbuilt `.js` with `.ts` beside.
 * 2. Import the specific subpath through the entry.
 * 3. Assert the specific pattern's source ran, not the generic one's.
 */
export const test_ttsx_selects_the_most_specific_pattern_export = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module", private: true }),
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
    "node_modules/pattern-dep/package.json": JSON.stringify({
      name: "pattern-dep",
      version: "1.0.0",
      type: "module",
      exports: {
        "./*": "./generic/*.js",
        "./feature/*": "./specific/*.js",
      },
    }),
    "node_modules/pattern-dep/generic/feature/tool.ts": `export const value = (): string => "generic";\n`,
    "node_modules/pattern-dep/specific/tool.ts": `export const value = (): string => "specific";\n`,
    "src/main.ts":
      `import { value } from "pattern-dep/feature/tool";\n` +
      `console.log(value());\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "specific");
};
