import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

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
 */
export const test_compiler_corpus_clean_removes_the_single_file_caches =
  (): void => {
    const root = commonJsProject({
      "src/main.ts": `export const value = "clean-single-file-caches";\n`,
    });
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
