import {
  assert,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/toolchain";

/**
 * Verifies ttsc reports the consumer tsgo version banner.
 *
 * The `--version` output must include both the `ttsc` version and the
 * underlying `tsgo` (TypeScript-Go) version so users can report reproducible
 * bugs. Pins the banner format and the presence of the `7.0.0-dev.*` tsgo
 * version string so a version-banner regression surfaces immediately in CI.
 *
 * 1. Run the real `ttsc` launcher with `--version`.
 * 2. Assert exit 0.
 * 3. Assert stdout starts with `ttsc ` and contains `Version 7.0.0-dev.`.
 */
export const test_ttsc_reports_the_consumer_tsgo_version_banner = () => {
  const result = spawn(ttscBin, ["--version"], { cwd: workspaceRoot });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ttsc /);
  assert.match(result.stdout, /Version 7\.0\.0-dev\./);
};
