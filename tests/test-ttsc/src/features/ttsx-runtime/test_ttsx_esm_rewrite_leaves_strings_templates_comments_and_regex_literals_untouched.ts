import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx ESM rewrite leaves strings, templates, comments, and regex
 * literals untouched.
 *
 * Ttsx rewrites bare-specifier ESM import paths in emitted `.js` files to add
 * `.js` extensions. The rewriter must use a proper scanner so it does not
 * corrupt import-like text that appears inside string literals, template
 * expressions, line comments, or regex literals.
 *
 * 1. Create an ESM entry that uses real imports alongside string/template/
 *    comment/regex values that contain import-shaped text.
 * 2. Run ttsx against the entry.
 * 3. Assert the program output matches the expected values, confirming the
 *    rewriter left non-import tokens intact.
 */
export const test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched =
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
      "src/dynamic.ts": `export const dynamic: string = "dynamic-ok";\n`,
      "src/helper.ts": `export const message: string = "scanner-ok";\n`,
      "src/main.ts": `
      import { message } from "./helper";
      const dynamic = await import("./dynamic");
      const interpolation = \`\${(await import("./dynamic")).dynamic}\`;
      const ordinary = "from './helper'";
      const template = \`import('./dynamic')\`;
      const regex = /import\\('\\.\\/helper'\\)/;
      // from './helper'
      console.log(JSON.stringify({
        message,
        dynamic: dynamic.dynamic,
        interpolation,
        ordinary,
        template,
        regex: regex.source,
      }));
    `,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      message: "scanner-ok",
      dynamic: "dynamic-ok",
      interpolation: "dynamic-ok",
      ordinary: "from './helper'",
      template: "import('./dynamic')",
      regex: "import\\('\\.\\/helper'\\)",
    });
  };
