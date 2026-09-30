import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies explicit and environment-selected cache targets cannot delete the
 * project.
 *
 * The witness project is test-owned so even the pre-fix behavior cannot reach
 * user or runner data. Both commands must fail before removing the source,
 * plugin-cache, or legacy-cache sentinels.
 *
 * 1. Reject an explicit cache root that equals the project.
 * 2. Reject an environment-selected Go cache with the same unsafe identity.
 * 3. Assert neither attempt removed any project or cache sentinel.
 */
export const test_compiler_corpus_clean_refuses_project_directory =
  (): void => {
    const root = commonJsProject({
      ".ttsc/keep.txt": "legacy root sentinel",
      "node_modules/.cache/ttsc/plugins/keep.txt": "plugin cache sentinel",
      "node_modules/.ttsc/keep.txt": "legacy node_modules sentinel",
      "src/main.ts": 'export const value = "keep";\n',
    });
    const result = spawn(
      ttscBin,
      ["clean", "--cwd", root, "--cache-dir", "."],
      { cwd: root },
    );

    assert.equal(result.status, 2, result.stderr);
    assert.match(
      result.stderr,
      /refusing to clean cache directory.*equals or contains project root/,
    );
    const goCacheResult = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        TTSC_GO_CACHE_DIR: root,
        HOME: path.join(root, "cache-home"),
        USERPROFILE: path.join(root, "cache-home"),
        XDG_CACHE_HOME: path.join(root, "cache-home", ".cache"),
        LOCALAPPDATA: path.join(root, "cache-home", "AppData", "Local"),
      },
    });
    assert.equal(goCacheResult.status, 2, goCacheResult.stderr);
    assert.match(
      goCacheResult.stderr,
      /refusing to clean cache directory.*equals or contains project root/,
    );
    for (const sentinel of [
      path.join(root, "src", "main.ts"),
      path.join(root, ".ttsc", "keep.txt"),
      path.join(root, "node_modules", ".cache", "ttsc", "plugins", "keep.txt"),
      path.join(root, "node_modules", ".ttsc", "keep.txt"),
    ]) {
      assert.equal(fs.existsSync(sentinel), true, `${sentinel} was removed`);
    }
  };
