import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx ignores literal ESM markers when detecting module format.
 *
 * Format detection is based on the JavaScript tsgo emitted, but marker words in
 * strings, template raw text, comments, or regex literals are not syntax. A raw
 * dependency with no package `type` and no real ESM syntax must stay CommonJS;
 * otherwise harmless text like `import.meta` would make Node run it as ESM and
 * break CommonJS globals.
 *
 * 1. Install a no-`type` raw dependency containing only literal ESM-looking text.
 * 2. Use `__dirname` so an ESM misclassification fails at runtime.
 * 3. Assert the dependency executes as CommonJS.
 */
export const test_ttsx_ignores_literal_esm_markers_when_detecting_module_format =
  () => {
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
      "node_modules/literal-cjs/package.json": JSON.stringify({
        name: "literal-cjs",
        version: "1.0.0",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/literal-cjs/index.ts":
        `declare const __dirname: string;\n` +
        `const returned = (): RegExp => {\n` +
        `  return /import\\.meta|export\\s+default/;\n` +
        `};\n` +
        `const markers = [\n` +
        `  "import.meta",\n` +
        `  "export const stale = true",\n` +
        `  /* export const comment = true */\n` +
        `  /import\\.meta|export\\s+default/,\n` +
        `  returned(),\n` +
        `  \`template text\\nexport const hidden = true\\nimport.meta\`,\n` +
        `];\n` +
        `(globalThis as Record<string, unknown>).__literalCjs =\n` +
        `  typeof __dirname === "string" && markers.length === 5\n` +
        `    ? "literal-cjs-ok"\n` +
        `    : "literal-cjs-bad";\n`,
      "src/main.ts":
        `import "literal-cjs";\n` +
        `console.log((globalThis as Record<string, unknown>).__literalCjs);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "literal-cjs-ok");
  };
