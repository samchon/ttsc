import {
  assert,
  createProject,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies ttsc cache paths JSON reports source build cache roots.
 *
 * Split CI jobs need stable cache paths without copying ttsc internals such as
 * `~/.cache/ttsc/plugins`. The cache paths command is the public contract for
 * discovering the source-plugin binary cache and the Go object cache ttsc uses
 * while building those binaries.
 *
 * 1. Create a project and request a relative `--cache-dir` from a different
 *    process cwd.
 * 2. Run `ttsc cache paths --json` with an explicit `TTSC_GO_CACHE_DIR`.
 * 3. Assert the JSON points at the cwd-resolved cache root, plugin root, and
 *    cacheable Go build root.
 */
export const test_ttsc_cache_paths_json_reports_source_build_cache_roots =
  () => {
    const root = createProject({
      "src/main.ts": "export const value = 1;\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: { outDir: "lib" },
        include: ["src"],
      }),
    });
    const goBuildCache = path.join(root, ".ci-go-build");

    const result = spawn(
      ttscBin,
      ["cache", "paths", "--json", "--cwd", root, "--cache-dir", ".ci/ttsc"],
      {
        cwd: workspaceRoot,
        env: {
          GOCACHE: "",
          TTSC_GO_CACHE_DIR: goBuildCache,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as {
      cacheRoot: string;
      cacheableRoots: string[];
      cwd: string;
      goBuildCacheRoot: string;
      goBuildCacheSource: string;
      pluginCacheRoot: string;
      projectRoot: string;
    };
    const cacheRoot = path.join(root, ".ci", "ttsc");
    assert.equal(parsed.cwd, root);
    assert.equal(parsed.projectRoot, root);
    assert.equal(parsed.cacheRoot, cacheRoot);
    assert.equal(parsed.pluginCacheRoot, path.join(cacheRoot, "plugins"));
    assert.equal(parsed.goBuildCacheRoot, goBuildCache);
    assert.equal(parsed.goBuildCacheSource, "TTSC_GO_CACHE_DIR");
    assert.deepEqual(parsed.cacheableRoots, [cacheRoot, goBuildCache]);
  };
