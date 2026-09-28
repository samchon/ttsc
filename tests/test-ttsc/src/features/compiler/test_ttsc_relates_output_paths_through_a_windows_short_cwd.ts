import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies paths printed through a Windows 8.3 cwd stay project-relative.
 *
 * `fs.realpathSync` can retain a short component while `.native` expands it.
 * Comparing those flavors put a cache or single-file output outside the cwd
 * even though both named the same project. This case runs where the test volume
 * actually supplies distinct short and long spellings.
 *
 * 1. Create a project under a short Windows temporary directory.
 * 2. Clean one legacy cache and compile one positional source through it.
 * 3. Assert both reported paths stay relative to that cwd.
 */
export const test_ttsc_relates_output_paths_through_a_windows_short_cwd =
  (): void => {
    if (process.platform !== "win32") return;
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { module: "commonjs", outDir: "lib" },
        include: ["src"],
      }),
      "src/index.ts": "export const value = 1;\n",
    });
    const short = fs.realpathSync(root);
    const long = fs.realpathSync.native(root);
    if (short.toLowerCase() === long.toLowerCase()) return;
    fs.mkdirSync(path.join(root, "node_modules", ".ttsc"), { recursive: true });

    const clean = spawn(ttscBin, ["clean", "--cwd", short], { cwd: short });
    assert.equal(clean.status, 0, clean.stderr);
    assert.ok(
      clean.stdout
        .split(/\r?\n/)
        .includes(`ttsc: removed ${path.join("node_modules", ".ttsc")}`),
      clean.stdout,
    );

    const build = spawn(ttscBin, ["--cwd", short, "src/index.ts"], {
      cwd: short,
    });
    assert.equal(build.status, 0, `${build.stdout}${build.stderr}`);
    assert.equal(build.stdout.trim(), path.join("lib", "src", "index.js"));
    assert.equal(fs.existsSync(path.join(root, "lib", "src", "index.js")), true);
  };
