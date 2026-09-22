import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
  ttsxBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsx TTSC_CACHE_DIR: relocates the runtime cache.
 *
 * `TTSC_CACHE_DIR` already owns source-plugin placement. Leaving transient
 * runtime output under the project gives one invocation two cache roots and can
 * create a false nested-project boundary even though plugins are shared.
 *
 * 1. Create a project and an external caller-owned cache root.
 * 2. Run ttsx with `TTSC_CACHE_DIR` and assert the program succeeds.
 * 3. Assert runtime and cache-path state use that root and touch no local cache.
 */
export const test_ttsx_ttsc_cache_dir_relocates_the_runtime_cache = () => {
  const root = createProject({
    "src/main.ts": `console.log("relocated-runtime-cache");\n`,
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        target: "ES2022",
      },
      include: ["src"],
    }),
  });
  const cache = createProject({});
  const env = { TTSC_CACHE_DIR: cache };

  const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
    cwd: root,
    env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "relocated-runtime-cache");
  assert.equal(fs.existsSync(path.join(root, "node_modules")), false);
  assert.deepEqual(fs.readdirSync(path.join(cache, "ttsx", "project")), []);

  const paths = spawn(ttscBin, ["cache", "paths", "--json", "--cwd", root], {
    cwd: root,
    env,
  });
  assert.equal(paths.status, 0, paths.stderr);
  assert.equal(
    (JSON.parse(paths.stdout) as { cacheRoot: string }).cacheRoot,
    cache,
  );
};
