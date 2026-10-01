import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies a lowercase `--outdir` overrides the project's `outDir` the same way
 * `--outDir` does.
 *
 * Tsgo honoured the case variant, but the launcher did not consume it, so
 * ttsc's own emitted-path resolution kept using the project value while tsgo
 * wrote somewhere else. The two layers disagreed about where the build landed.
 *
 * 1. Create a project whose tsconfig sets `outDir` to `dist`.
 * 2. Run `ttsc --emit --outdir out`.
 * 3. Assert the emit landed under `out` and not under `dist`.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --emit --outdir out for a project configured with dist and requires success, out/main.js presence and dist/main.js absence.
 * @evidence contracts/testing.md#independent-expectations The explicit lowercased compiler flag must override the authored config directory; independent literal output paths distinguish applied from ignored override.
 * @evidence contracts/testing.md#distinguishing-cases Lowercase spelling plus conflicting config isolates case-insensitive flag forwarding; no-rootDir output-layout comparison is owned separately.
 * @evidence contracts/testing.md#execution-ownership The named compiler feature is discovered by TestExecutor and performs actual native emission.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler publication must reflect the forwarded outDir rather than only an option object; direct flag normalization cannot establish disk placement.
 * @evidence contracts/e2e.md#shared-execution One emit supplies both positive and negative paths using shared launcher/compiler artifacts, with no contributor preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered project owns both candidate output roots and starts with neither file, so previous emit cannot satisfy the positive. Synchronous child completion precedes checks and suite cleanup owns removal.
 * @evidence contracts/e2e.md#preserved-coverage Original success, new-output existence and old-output absence remain. Generated contents and source-map path behavior are not asserted.
 */
export const test_ttsc_outdir_flag_in_lowercase_overrides_the_project_out_dir =
  () => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_outdir_flag_in_lowercase_overrides_the_project_out_dir/inputs-1"));

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--outdir", "out"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.existsSync(path.join(root, "out", "main.js")),
      true,
      `expected the emit under out/:\n${result.stdout}${result.stderr}`,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
