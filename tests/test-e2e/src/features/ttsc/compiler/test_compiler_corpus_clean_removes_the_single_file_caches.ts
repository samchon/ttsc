import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

/**
 * Verifies `ttsc clean` removes the descriptor evaluations, the capability
 * answers, and the lowered orphan sources, beside the plugin binaries.
 *
 * The three caches live in the resolved cache root, one file per key, and `ttsc
 * clean` removed only `plugins/` and the Go object cache, so they outlived
 * every clean (samchon/ttsc#1562). The orphan cache of earlier releases, in the
 * system temporary directory, is reclaimed with the other legacy locations.
 *
 * 1. Seed `descriptors/`, `capabilities/` and `ttsx-orphan/` in the project's
 *    default cache root, and a legacy `ttsc-orphan/` in the temporary directory
 *    the command sees.
 * 2. Run `ttsc clean`.
 * 3. Assert each is reported removed and is gone, and the root itself stays.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc clean over seeded descriptors, capabilities, ttsx-orphan and a legacy temp ttsc-orphan tree; asserts zero exit, all three active removal reports, disappearance of active/legacy contents and preservation of the parent cache root.
 * @evidence contracts/testing.md#independent-expectations File caches are cleanup-owned leaves while their parent may be shared. Independent fixture roots and literal leaf-absent/parent-present results detect both under-cleaning and excessive deletion.
 * @evidence contracts/testing.md#distinguishing-cases Owns three active file-cache namespaces and the earlier temp orphan location, with a surviving parent counterexample. Plugin cache cleanup has separate entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_clean_removes_the_single_file_caches is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The CLI must route all current and legacy namespaces to actual filesystem removal without deleting their parent; target enumeration units alone cannot prove these effects.
 * @evidence contracts/e2e.md#shared-execution One command batches four cache populations under one isolated project/home/temp environment. Seeded payloads need no native producer, and existing launcher installation is reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity HOME/USERPROFILE/XDG_CACHE_HOME/LOCALAPPDATA and TEMP/TMP/TMPDIR are scoped to the command and point inside the fixture. An explicit pnpm workspace marker selects this fixture as the cache owner despite ambient ancestor installations; all inspected data is test-owned, commands finish synchronously, and TestProject reclaims it at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Every active removal report, each leaf absence, legacy-root absence and parent survival assertion remains in this entry; no meaningful namespace distinction is transferred or removed.
 */
export const test_compiler_corpus_clean_removes_the_single_file_caches =
  (): void => {
    const root = commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_clean_removes_the_single_file_caches/inputs-1"));
    const cacheRoot = path.join(root, "node_modules", ".cache", "ttsc");
    const parts = ["descriptors", "capabilities", "ttsx-orphan"].map((name) =>
      path.join(cacheRoot, name),
    );
    for (const part of parts) {
      fs.mkdirSync(part, { recursive: true });
      fs.writeFileSync(path.join(part, "entry"), "{}", "utf8");
    }
    // Isolate the machine cache and temporary locations, so the legacy
    // reclamation touches only this test's copies.
    const home = path.join(root, "cache-home");
    const temp = path.join(root, "temp");
    const legacyOrphan = path.join(temp, "ttsc-orphan", "ttsx-orphan");
    fs.mkdirSync(legacyOrphan, { recursive: true });
    fs.writeFileSync(path.join(legacyOrphan, "entry.js"), "", "utf8");
    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: path.join(home, ".cache"),
        LOCALAPPDATA: path.join(home, "AppData", "Local"),
        TEMP: temp,
        TMP: temp,
        TMPDIR: temp,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    for (const name of ["descriptors", "capabilities", "ttsx-orphan"])
      assert.match(
        result.stdout,
        new RegExp(
          String.raw`removed node_modules[/\\]\.cache[/\\]ttsc[/\\]` + name,
        ),
      );
    for (const part of parts) assert.equal(fs.existsSync(part), false, part);
    assert.equal(fs.existsSync(path.join(temp, "ttsc-orphan")), false);
    assert.equal(fs.existsSync(cacheRoot), true, "the root itself was removed");
  };
