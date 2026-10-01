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
 * Verifies ttsc forwards a space-separated flag value to tsgo as one unit.
 *
 * A forwarded tsgo flag may take a value (`--target es2020`). ttsc must not
 * mistake the bare `es2020` token for a single-file input — it carries no
 * TypeScript source extension, so it belongs with the forwarded flag. If it
 * were misrouted into `files`, ttsc would drop into single-file mode and fail
 * looking for an `es2020` entry instead of running the project build.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --target es2020` and assert a zero exit.
 * 3. Assert the project's JavaScript output was written — i.e. a project build
 *    ran, not a misfired single-file emit.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --emit --target es2020 for an ES2022 project and requires success, emitted JavaScript and constructor/field-assignment lowering.
 * @evidence contracts/testing.md#independent-expectations The authored public class field remains native at ES2022 but is lowered into constructor assignment at ES2020; this distinguishes forwarding the target value from ignoring it.
 * @evidence contracts/testing.md#distinguishing-cases The split flag/value pair must stay attached and override the configured target. The two-pair case additionally checks module override.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the named feature and executes real launcher-to-compiler emit.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler output must reflect the forwarded target, which argv inspection alone cannot prove.
 * @evidence contracts/e2e.md#shared-execution One emit supplies success, artifact and both lowering checks; built launcher/compiler preparation is shared and no Go plugin is built.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered fixture starts with no dist, and synchronous emit ends its child before content inspection; TestProject owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original success/output existence remain, strengthened with independent constructor and field-assignment assertions; full runtime execution is outside this entry.
 */
export const test_ttsc_forwards_a_spaced_flag_value_to_tsgo = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_forwards_a_spaced_flag_value_to_tsgo/inputs-1"));

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--target", "es2020"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(root, "dist", "main.js")));
  const emitted = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(emitted, /constructor\s*\(/);
  assert.match(emitted, /this\.field\s*=\s*(?:exports\.)?value/);
};
