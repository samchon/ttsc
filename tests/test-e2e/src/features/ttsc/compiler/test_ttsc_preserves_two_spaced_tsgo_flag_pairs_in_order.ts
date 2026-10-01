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
 * Verifies ttsc forwards two space-valued tsgo flags to the build with each
 * flag still adjacent to its own value.
 *
 * The old parser split every unknown flag from its bare value and rebuilt the
 * stream as `[...flags, ...values]`, so `--target es2020 --module commonjs`
 * reached tsgo as `--target --module es2020 commonjs`. tsgo then reads
 * `--module` as the value of `--target`, rejects it as an invalid target, and
 * the build fails. A build that succeeds and emits proves each value stayed
 * with its flag.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --target es2020 --module commonjs`.
 * 3. Assert a zero exit and that the project's JavaScript was emitted.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --target es2020 --module commonjs against ES2022/esnext config; requires emit success, constructor lowering, CommonJS Box export and no ESM export syntax.
 * @evidence contracts/testing.md#independent-expectations Authored public class field and ESM-configured exports require different output after both explicit overrides; emitted constructor and exports.Box independently detect ignoring either pair.
 * @evidence contracts/testing.md#distinguishing-cases Two separate option/value pairs distinguish value binding from the one-pair case. Their values differ from config to keep both effects observable.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the named feature and invokes real ttsc-to-tsgo emit.
 * @evidence contracts/e2e.md#necessary-boundary Both forwarded argv pairs must affect the actual generated program; pure parsing or output-file existence cannot establish target and module overrides.
 * @evidence contracts/e2e.md#shared-execution One emit supplies all lowered-class/CommonJS checks while sharing built executables and avoiding plugin preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered source/config fixture owns its output and starts with no dist; synchronous command completion precedes reads and TestProject cleans the directory at exit.
 * @evidence contracts/e2e.md#preserved-coverage Original success/output existence remain, strengthened with target lowering and CommonJS-versus-ESM assertions. Distinct option pairs commute semantically, so exact argv order is not separately observed.
 */
export const test_ttsc_preserves_two_spaced_tsgo_flag_pairs_in_order = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_preserves_two_spaced_tsgo_flag_pairs_in_order/inputs-1"));

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--target", "es2020", "--module", "commonjs"],
    { cwd: root },
  );
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.ok(fs.existsSync(path.join(root, "dist", "main.js")));
  const emitted = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(emitted, /constructor\s*\(/);
  assert.match(emitted, /exports\.Box\s*=/);
  assert.doesNotMatch(emitted, /export\s+(?:const|class)\s/);
};
