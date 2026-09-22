import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  pluginCacheEntryDirs,
  spawn,
  ttscBin,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx nested project reuses the prepared workspace
 * cache.
 *
 * Cache-path equality is only useful if the real source-plugin builder consumes
 * it. This case warms a manifest-less fixture at its outer install root, then
 * enters through a nested tsconfig and proves no second Go build occurs.
 *
 * 1. Copy the source-plugin fixture and add a nested extending tsconfig.
 * 2. Prepare that project with the default cache and observe one cold build.
 * 3. Run it through ttsx, assert the warm binary is reused, and find one cache.
 */
export const test_plugin_corpus_ttsx_nested_project_reuses_the_prepared_workspace_cache =
  () => {
    const root = copyProject("go-source-plugin");
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.mkdirSync(path.join(root, "test", "src"), { recursive: true });
    fs.copyFileSync(
      path.join(root, "src", "main.ts"),
      path.join(root, "test", "src", "main.ts"),
    );
    fs.writeFileSync(
      path.join(root, "test", "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "../dist",
          plugins: [{ transform: "../plugin.cjs" }],
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "utf8",
    );
    const env = { PATH: goPath(), TTSC_CACHE_DIR: "" };

    const prepared = spawn(
      ttscBin,
      ["prepare", "--cwd", root, "--project", "test/tsconfig.json"],
      { cwd: root, env },
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.match(prepared.stderr, /building source plugin "go-source-plugin"/);

    const executed = spawn(
      ttsxBin,
      ["--cwd", root, "--project", "test/tsconfig.json", "test/src/main.ts"],
      { cwd: root, env },
    );
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(executed.stdout.trim(), "PLUGIN");
    assert.doesNotMatch(executed.stderr, /building source plugin/);
    assert.equal(fs.existsSync(path.join(root, "test", "node_modules")), false);
    assert.equal(
      pluginCacheEntryDirs(
        path.join(root, "node_modules", ".cache", "ttsc", "plugins"),
      ).length,
      1,
    );
  };
