import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx fails naming both files when the output its checked build
 * emitted for a source has disappeared.
 *
 * Once a build is proven to own a source, its output is the only JavaScript
 * that may run for it. Falling through to the next lane would run something
 * the checked build never produced — an isolated emit without the project's
 * transforms, or, before samchon/ttsc#1382, another file's output. An owned
 * output that cannot be read is therefore an error that names the source and
 * the missing file.
 *
 * 1. Create a project whose entry locates its own build's output for
 *    `src/lazy.ts` through the runtime manifest and deletes it.
 * 2. Require `./lazy` afterwards.
 * 3. Assert the run fails naming `lazy.ts` and the missing `lazy.js`, and that
 *    `lazy.ts` never ran.
 */
export const test_ttsx_reports_a_missing_owned_emit_by_name = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "missing-emit", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "lib",
        types: [],
      },
      include: ["src"],
    }),
    "src/lazy.ts": `console.log("lazy ran");\nexport const lazy: string = "lazy";\n`,
    "src/main.ts": [
      `declare const require: (id: string) => any;`,
      `declare const process: { env: Record<string, string | undefined> };`,
      `declare const __dirname: string;`,
      `const fs = require("node:fs");`,
      `const path = require("node:path");`,
      `const manifest = JSON.parse(`,
      `  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST!, "utf8"),`,
      `);`,
      `const source: string = fs.realpathSync.native(path.join(__dirname, "lazy.ts"));`,
      `const relative: string = path.relative(manifest.rootDir, source);`,
      `const output: string = path.join(manifest.emitDir, relative.replace(/\\.ts$/, ".js"));`,
      `fs.rmSync(output);`,
      `require("./lazy");`,
      `export {};`,
      ``,
    ].join("\n"),
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(
    result.stderr,
    /the JavaScript emitted for .*lazy\.ts is missing: .*lazy\.js/,
  );
  assert.doesNotMatch(result.stdout, /lazy ran/);
};
