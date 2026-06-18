import {
  assert,
  createFakeNativePreview,
  createProject,
  fs,
  path,
  spawnWithoutTsgoOverride,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc version makes consumer tsgo executable before spawn.
 *
 * The version path shares `spawnNative` with build paths so first-run package
 * installs whose platform binary lacks POSIX executable bits still work. The
 * normal banner test uses the workspace binary, so this case uses a local fake
 * `typescript` package and removes its executable bits before invoking ttsc.
 *
 * 1. Create a project-local fake `typescript` package.
 * 2. On POSIX, remove executable bits from the fake `tsc`.
 * 3. Run `ttsc --version` without workspace tsgo overrides.
 * 4. Assert the fake version is printed and the binary was repaired.
 */
export const test_ttsc_version_makes_consumer_tsgo_executable_before_spawn =
  () => {
    if (process.platform === "win32") {
      return;
    }
    const root = createProject({
      "package.json": JSON.stringify({ private: true }),
    });
    createFakeNativePreview(
      root,
      `
if (process.argv.slice(2).includes("--version")) {
  console.log("Version 7.0.0-dev.NONEXEC");
  process.exit(0);
}
process.exit(1);
`,
    );
    const tsgo = path.join(
      root,
      "node_modules",
      "@typescript",
      `typescript-${process.platform}-${process.arch}`,
      "lib",
      "tsc",
    );
    fs.chmodSync(tsgo, 0o644);

    const result = spawnWithoutTsgoOverride(ttscBin, ["--version"], {
      cwd: root,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ttsc /);
    assert.match(result.stdout, /Version 7\.0\.0-dev\.NONEXEC/);
    assert.notEqual(fs.statSync(tsgo).mode & 0o111, 0);
  };
