import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin default cache is global content cache.
 *
 * The default source-plugin cache must not be tied to one package's
 * node_modules layout. Pnpm can install the same ttsc/plugin sources through
 * different virtual-store paths, so ttsc stores content-addressed plugin
 * binaries in the user cache unless callers request an explicit cache root.
 *
 * 1. Point the process user-cache root at an isolated temp directory.
 * 2. Run ttsc against a source-plugin project without TTSC_CACHE_DIR.
 * 3. Assert the binary lands in the global ttsc cache and not project-local .ttsc
 *    directories.
 */
export const test_plugin_corpus_source_plugin_default_cache_is_global_content_cache =
  () => {
    const root = setupLintProject("lint-violations");
    const cacheHome = fs.mkdtempSync(path.join(root, "cache-home-"));
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `export const value: string = "local-cache";\n`,
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
          plugins: [{ transform: "@ttsc/lint", config: { "no-var": "error" } }],
        },
        include: ["src"],
      }),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: { PATH: goPath(), XDG_CACHE_HOME: cacheHome },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);

    const pluginCache = path.join(cacheHome, "ttsc", "plugins");
    const entries = fs
      .readdirSync(pluginCache, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("scratch-"),
      );
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.ok(entry);
    assert.equal(
      fs.existsSync(
        path.join(
          pluginCache,
          entry.name,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        ),
      ),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, "node_modules", ".ttsc")),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
  };
