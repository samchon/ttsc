import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  os,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint option changes reuse the source plugin
 * binary cache.
 *
 * Rule configuration is passed at runtime as `--plugins-json`; it is not baked
 * into the binary. Changing which rules are enabled must not trigger a Go
 * rebuild because the binary itself is unchanged — only the runtime arguments
 * differ. Rebuilding on every config change would make lint impractically
 * slow.
 *
 * 1. Run ttsc with `no-var: error` (cold build) and assert the binary is built.
 * 2. Swap the config to `no-explicit-any` and `prefer-template` and run again.
 * 3. Assert no rebuild occurs, JS is emitted to the custom outDir, and only one
 *    binary entry exists in the plugin cache.
 */
export const test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const value: string = "cache-options";\n`,
    );
    const writeConfig = (config: Record<string, string>) => {
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            outDir: "dist",
            rootDir: "src",
            plugins: [{ transform: "@ttsc/lint", config }],
          },
          include: ["src"],
        }),
      );
    };
    const cacheDir = TestProject.tmpdir("ttsc-lint-cache-options-");
    const env = { PATH: goPath(), TTSC_CACHE_DIR: cacheDir };

    writeConfig({ "no-var": "error" });
    const first = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env,
    });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stderr, /building source plugin "@ttsc\/lint"/);

    writeConfig({ "no-explicit-any": "warning", "prefer-template": "warning" });
    const second = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--outDir", "custom"],
      {
        cwd: root,
        env,
      },
    );
    assert.equal(second.status, 0, second.stderr);
    assert.doesNotMatch(second.stderr, /building source plugin "@ttsc\/lint"/);
    assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), true);

    const pluginCache = path.join(cacheDir, "plugins");
    const entries = fs
      .readdirSync(pluginCache, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("scratch-"),
      );
    assert.equal(entries.length, 1);
  };
