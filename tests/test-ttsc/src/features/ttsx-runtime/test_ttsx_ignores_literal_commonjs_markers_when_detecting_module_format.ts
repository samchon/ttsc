import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx ignores literal CommonJS markers when detecting module format.
 *
 * CommonJS detection runs before ESM detection so real `exports.*` emit from a
 * CommonJS build wins. That priority must not treat `exports.fake` inside a
 * string, comment, template, or regex as CommonJS syntax; a `type: "module"`
 * raw dependency that uses real `import.meta` must still run as ESM.
 *
 * 1. Install a `type: "module"` raw dependency containing literal CJS-looking
 *    text.
 * 2. Use `import.meta.url` so a CJS misclassification fails at runtime.
 * 3. Assert the dependency executes as ESM.
 */
export const test_ttsx_ignores_literal_commonjs_markers_when_detecting_module_format =
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
      "node_modules/literal-esm/package.json": JSON.stringify({
        name: "literal-esm",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/literal-esm/index.ts":
        `const returned = (): RegExp => {\n` +
        `  return /exports\\.fake|module\\.exports/;\n` +
        `};\n` +
        `const markers = [\n` +
        `  "exports.fake = true",\n` +
        `  "module.exports = {}",\n` +
        `  /* Object.defineProperty(exports, "__esModule", { value: true }) */\n` +
        `  /exports\\.fake|module\\.exports/,\n` +
        `  returned(),\n` +
        `  \`template text\\nexports.hidden = true\\nmodule.exports = {}\`,\n` +
        `];\n` +
        `const here: string = import.meta.url;\n` +
        `export const value: string = here.startsWith("file:") && markers.length === 5\n` +
        `  ? "literal-esm-ok"\n` +
        `  : "literal-esm-bad";\n`,
      "src/main.ts":
        `import { value } from "literal-esm";\n` + `console.log(value);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "literal-esm-ok");
  };
