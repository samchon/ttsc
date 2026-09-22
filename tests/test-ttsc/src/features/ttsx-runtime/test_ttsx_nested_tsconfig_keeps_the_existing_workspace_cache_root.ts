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
 * Verifies ttsx nested tsconfig: keeps the existing workspace cache root.
 *
 * The ttsx runtime directory used to be created below the tsconfig directory
 * before source-plugin cache discovery. That new `node_modules` became a false
 * project boundary, so a cache warmed at the package root was missed.
 *
 * 1. Create a single package with a root install and a nested tsconfig.
 * 2. Run ttsx without plugins and assert it creates no nested `node_modules`.
 * 3. Assert cache-path discovery names the same root before and after the run.
 */
export const test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root =
  () => {
    const root = createProject({
      "package.json": JSON.stringify({ name: "nested-cache-root" }),
      "test/main.ts": `console.log("nested-cache-root");\n`,
      "test/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "../dist",
          rootDir: ".",
          strict: true,
          target: "ES2022",
        },
        include: ["main.ts"],
      }),
    });
    fs.mkdirSync(path.join(root, "node_modules"));

    const before = cacheRoot(root);
    const result = spawn(
      ttsxBin,
      ["--cwd", root, "--project", "test/tsconfig.json", "test/main.ts"],
      { cwd: root, env: { TTSC_CACHE_DIR: "" } },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "nested-cache-root");
    assert.equal(fs.existsSync(path.join(root, "test", "node_modules")), false);
    assert.equal(before, path.join(root, "node_modules", ".cache", "ttsc"));
    assert.equal(cacheRoot(root), before);
    assert.deepEqual(fs.readdirSync(path.join(before, "ttsx", "project")), []);
  };

function cacheRoot(root: string): string {
  const result = spawn(
    ttscBin,
    [
      "cache",
      "paths",
      "--json",
      "--cwd",
      root,
      "--project",
      "test/tsconfig.json",
    ],
    { cwd: root, env: { TTSC_CACHE_DIR: "" } },
  );
  assert.equal(result.status, 0, result.stderr);
  return (JSON.parse(result.stdout) as { cacheRoot: string }).cacheRoot;
}
