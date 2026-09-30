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
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc clean with explicit cache-dir dot and with TTSC_GO_CACHE_DIR equal to the fixture project; asserts exit 2, refusal text and preservation of source, active-plugin and both legacy-cache sentinels.
 * @evidence contracts/testing.md#independent-expectations A cache cleanup target may not equal or contain the project root. Literal rejection status/message and externally planted sentinels establish that safety contract independently of target resolution.
 * @evidence contracts/testing.md#distinguishing-cases Owns explicit versus environment-selected unsafe roots and four protected subtree witnesses. Safe explicit/default cleanup has separate clean entries; an ancestor-of-project target is not exercised here.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_clean_refuses_project_directory is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary CLI argument/environment selection must reach the cleanup safety gate before real filesystem deletion; a direct target predicate cannot establish launcher wiring or survival of its consumer tree.
 * @evidence contracts/e2e.md#shared-execution Two short CLI commands share one project because rejection must leave its inputs intact. Isolated machine cache variables are supplied for the environment-selected command; no compiler/native producer is built.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only fixture-owned paths can be deletion candidates; the second command reads the first rejection state deliberately. HOME/USERPROFILE/XDG_CACHE_HOME/LOCALAPPDATA are child-only overrides and TestProject removes the root at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Both refusal paths and every existing sentinel assertion remain in this named case. It verifies real cleanup consequences; containment above the root remains outside its coverage.
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
