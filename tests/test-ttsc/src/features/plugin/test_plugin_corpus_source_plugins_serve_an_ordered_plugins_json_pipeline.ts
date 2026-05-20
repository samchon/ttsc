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
 * Verifies plugin corpus: source plugins serve an ordered `--plugins-json`
 * pipeline.
 *
 * Multiple entries in tsconfig plugins that resolve to the same Go source
 * directory all share the same cached binary, but each entry may carry
 * different `prefix`/`suffix` options. ttsc serialises all entries into the
 * `--plugins-json` argument so the single sidecar binary applies each
 * transformation in declaration order.
 *
 * 1. Rewrite `plugin.cjs` as a context-aware factory and configure three entries
 *    (prefix `A:`, identity, suffix `:Z`) all pointing at the same source
 *    directory.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and `"A:PLUGIN:Z"` in the emitted JS.
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
