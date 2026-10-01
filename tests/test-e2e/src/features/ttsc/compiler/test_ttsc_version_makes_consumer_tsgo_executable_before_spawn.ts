import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createFakeNativePreview,
  createProject,
  fs,
  path,
  spawnWithoutTsgoOverride,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

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
 *
 * @evidence contracts/testing.md#behavioral-verification POSIX local fake compiler chmod644 is invoked through --version; expected NONEXEC banner prints and executable mode is repaired.
 * @evidence contracts/testing.md#independent-expectations Scripted version literal distinguishes consumer binary from workspace one; explicit mode bits prove repair before successful execution.
 * @evidence contracts/testing.md#distinguishing-cases Non-executable consumer-local version binary; Windows returns without this POSIX case.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_version_makes_consumer_tsgo_executable_before_spawn is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual package resolution, chmod and OS executable spawn use a deliberate fake producer; real TypeScript version semantics are not tested.
 * @evidence contracts/e2e.md#shared-execution One consumer fixture and version invocation prove repair. createFakeNativePreview reuses a process-built Go script launcher, while the copied consumer executable is private and deliberately chmod644. No real compiler build or semantic compile is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private package installation owns mode changes; spawnWithoutTsgoOverride removes both workspace binary overrides only in child environment. POSIX mode repair is observable before process completion; Windows skips. Tracked root and shared stub-launcher temp root end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: POSIX local fake compiler chmod644 is invoked through --version; expected NONEXEC banner prints and executable mode is repaired. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_version_makes_consumer_tsgo_executable_before_spawn =
  () => {
    if (process.platform === "win32") {
      return;
    }
    const root = createProject(FixtureFiles.read("ttsc/ttsc_version_makes_consumer_tsgo_executable_before_spawn/inputs-1"));
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
