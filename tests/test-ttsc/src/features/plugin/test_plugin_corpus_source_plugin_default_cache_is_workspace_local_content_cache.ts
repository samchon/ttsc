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
 * Verifies plugin corpus: source plugin default cache is workspace-local
 * content cache.
 *
 * With no cache override, ttsc must store the content-addressed plugin binary
 * in the workspace's `node_modules/.cache/ttsc` (shared across the monorepo,
 * and reclaimed by `rm -rf node_modules`) — never a global user cache and never
 * a package-local `.ttsc` directory. Pins that default placement end-to-end.
 *
 * 1. Run real ttsc against a source-plugin project with no cache override.
 * 2. Assert the one content-keyed binary lands under the workspace-local cache.
 * 3. Assert no legacy `.ttsc` directories were created.
 */
export const test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache =
  () => {
    const root = setupLintProject("lint-violations");
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
          plugins: [{ transform: "@ttsc/lint" }],
        },
        include: ["src"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules: { "no-var": "error" } }),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "@ttsc\/lint"/);

    const pluginCache = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "plugins",
    );
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
