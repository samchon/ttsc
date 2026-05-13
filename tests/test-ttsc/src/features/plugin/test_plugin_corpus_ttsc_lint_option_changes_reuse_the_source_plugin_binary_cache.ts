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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-cache-options-"),
    );
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
