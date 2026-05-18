import { TestProject } from "@ttsc/testing";

import {
  __dirname,
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugins serve an ordered --plugins-json
 * pipeline.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_source_plugins_serve_an_ordered_plugins_json_pipeline =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-ordered-");
    // Override plugin.cjs to expose a context-driven manifest factory so we can
    // declare prefix → upper → suffix as ordered entries that all share the
    // same source dir (and therefore the same compiled binary).
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: path.resolve(__dirname, "go-plugin"),
});
`,
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          plugins: [
            { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
            { transform: "./plugin.cjs", name: "upper" },
            { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
          ],
        },
        include: ["src"],
      }),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"A:PLUGIN:Z"/,
    );
  };
