import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx declares the TypeScript extensions in `require.extensions`, so
 * CommonJS tools that detect a loader there load a `.ts` config.
 *
 * `rechoir`, which `webpack-cli`, `gulp-cli`, and `knex` use for
 * `webpack.config.ts` and its siblings, takes a present
 * `require.extensions[".ts"]` as "a loader is installed" and otherwise tries to
 * install `ts-node` or another loader of its own, failing when none is found.
 * Node defines no TypeScript key on any release, and #1559 had removed the one
 * ttsx set, so `webpack-cli` stopped with "Please install one of them" under
 * ttsx and `ttsc/register` (samchon/ttsc#1560). The key now carries Node's own
 * `.js` handler, and the hooks still serve the source. Node probes these keys
 * after its own for an extensionless request, which the case also pins.
 *
 * 1. In a CommonJS project, check the key the way `rechoir.prepare` does, then
 *    `require` a typed config through it.
 * 2. Require and resolve a lone `y.ts` without an extension, and require an `x`
 *    that exists as both `x.js` and `x.ts`.
 * 3. Assert the key is Node's `.js` handler, the typed config loads, the lone
 *    source is found, and `x.js` still wins, as it does for Node.
 */
export const test_ttsx_advertises_typescript_to_commonjs_extension_detection =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": [
        `declare const require: any;`,
        `const extensions = require.extensions;`,
        `// What rechoir.prepare checks before it loads a config.`,
        `const detected = typeof extensions[".ts"] === "function";`,
        `console.log(JSON.stringify({`,
        `  config: detected ? require("./config.ts").value : "refused",`,
        `  lone: require("./both/y"),`,
        `  loneResolved: require.resolve("./both/y").endsWith("y.ts"),`,
        `  nodeHandler: extensions[".ts"] === extensions[".js"],`,
        `  precedence: require("./both/x"),`,
        `}));`,
        ``,
      ].join("\n"),
      "src/config.ts": `const value: string = "typed-config";
export = { value };
`,
      "src/both/x.js": `module.exports = "from-js";\n`,
      "src/both/x.ts": `export = "from-ts";
`,
      "src/both/y.ts": `export = "only-ts";
`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      config: "typed-config",
      lone: "only-ts",
      loneResolved: true,
      nodeHandler: true,
      precedence: "from-js",
    });
  };
