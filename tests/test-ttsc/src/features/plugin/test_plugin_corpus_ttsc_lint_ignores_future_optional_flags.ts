import {
  assert,
  fs,
  goPath,
  nativeBinary,
  os,
  path,
  requireFromTest,
  setupLintProject,
  spawn,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint ignores future optional flags.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_ttsc_lint_ignores_future_optional_flags =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          plugins: [{ transform: "@ttsc/lint", config: {} }],
        },
        include: ["src"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const value: string = "future-flag";\n`,
    );

    const { loadProjectPlugins } = requireFromTest(
      path.join(
        workspaceRoot,
        "packages",
        "ttsc",
        "lib",
        "plugin",
        "internal",
        "loadProjectPlugins.js",
      ),
    );
    const previousPath = process.env.PATH;
    const previousCacheDir = process.env.TTSC_CACHE_DIR;
    process.env.PATH = goPath();
    process.env.TTSC_CACHE_DIR = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-future-flag-"),
    );
    let loaded;
    try {
      loaded = loadProjectPlugins({
        binary: nativeBinary,
        cwd: root,
        tsconfig: path.join(root, "tsconfig.json"),
      });
    } finally {
      process.env.PATH = previousPath;
      if (previousCacheDir === undefined) {
        delete process.env.TTSC_CACHE_DIR;
      } else {
        process.env.TTSC_CACHE_DIR = previousCacheDir;
      }
    }
    const loadedBinary = loaded.nativePlugins[0]?.binary;
    assert.equal(typeof loadedBinary, "string");
    const pluginsJson = JSON.stringify(
      loaded.nativePlugins.map(
        (plugin: { config: unknown; name: string; stage: string }) => ({
          config: plugin.config,
          name: plugin.name,
          stage: plugin.stage,
        }),
      ),
    );

    const result = spawn(
      loadedBinary,
      [
        "check",
        "--cwd",
        root,
        "--tsconfig",
        path.join(root, "tsconfig.json"),
        "--plugins-json",
        pluginsJson,
        "--future-optional-flag",
        "ignored-value",
      ],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
  };
