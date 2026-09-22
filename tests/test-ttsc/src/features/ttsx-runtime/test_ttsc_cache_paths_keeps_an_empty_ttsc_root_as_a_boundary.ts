import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies cache paths: keeps an empty ttsc root as a project boundary.
 *
 * The first default-cache writer creates `.cache/ttsc` before it can publish
 * the workspace marker. A concurrent resolver must retain that in-progress
 * boundary instead of escaping to a populated ancestor during the short gap.
 *
 * 1. Create a populated outer install and an empty nested `.cache/ttsc` root.
 * 2. Resolve cache paths for the nested project during that pre-marker state.
 * 3. Assert the nested default root remains authoritative.
 */
export const test_ttsc_cache_paths_keeps_an_empty_ttsc_root_as_a_boundary =
  () => {
    const root = createProject({
      "node_modules/dependency/package.json": JSON.stringify({
        name: "dependency",
      }),
      "test/main.ts": `export const value = 1;\n`,
      "test/node_modules/.cache/ttsc/.gitkeep": "",
      "test/tsconfig.json": JSON.stringify({
        compilerOptions: { outDir: "../dist", rootDir: "." },
        include: ["main.ts"],
      }),
    });
    const ttscRoot = path.join(root, "test", "node_modules", ".cache", "ttsc");
    // `createProject` needs a file to materialize the directory; removing it
    // leaves the precise state between root creation and marker publication.
    fs.rmSync(path.join(ttscRoot, ".gitkeep"));

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
    assert.equal(
      (JSON.parse(result.stdout) as { cacheRoot: string }).cacheRoot,
      ttscRoot,
    );
  };
