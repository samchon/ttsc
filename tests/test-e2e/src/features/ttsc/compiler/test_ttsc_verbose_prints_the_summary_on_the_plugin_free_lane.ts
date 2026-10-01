import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies `--verbose` prints the documented build summary on a project that
 * declares no ttsc plugin.
 *
 * The flag worked only on the native-host lane, which runs when a project has
 * at least one native plugin, so on the common case it produced nothing on
 * either stream while the guide and `--help` both promise "the build summary
 * and emitted files". Verbosity is a presentation concern; which lane
 * `runBuild` picks is an implementation detail the user cannot see, so a
 * documented flag must not change meaning with it.
 *
 * 1. Build a plugin-free project once with `--verbose` and once without.
 * 2. Assert the verbose run prints the header, the count, and one line per emitted
 *    file, with no raw `TSFILE:` line leaking through.
 * 3. Assert the plain run stays silent, so the flag is what produced the output.
 *
 * @evidence contracts/testing.md#behavioral-verification Verbose plugin-free emit prints summary, emitted count and both file entries without raw TSFILE; plain build exits zero with empty stdout.
 * @evidence contracts/testing.md#independent-expectations Literal documented summary syntax and authored two filenames independently define output; exact numeric count is not checked.
 * @evidence contracts/testing.md#distinguishing-cases Verbose versus plain same project with two emitted sources, zero plugin sites.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_verbose_prints_the_summary_on_the_plugin_free_lane is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual native emit listing crosses launcher formatting without internal listing leaking to user stdout.
 * @evidence contracts/e2e.md#shared-execution One two-source project and workspace binary installation serve verbose and plain runs; two process lifetimes are necessary to compare presentation flags. Existing emitted output is reused as fixture state, but each run requests actual emit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/config contain no plugins, fixing lane selection; verbose/plain flags differ only in child argv. Synchronous child completion precedes assertions. Tracked root ends at process exit; cancellation of a hung child is not tested.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Verbose plugin-free emit prints summary, emitted count and both file entries without raw TSFILE; plain build exits zero with empty stdout. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_verbose_prints_the_summary_on_the_plugin_free_lane =
  () => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_verbose_prints_the_summary_on_the_plugin_free_lane/inputs-1"));

    const verbose = spawn(ttscBin, ["--cwd", root, "--emit", "--verbose"], {
      cwd: root,
    });
    assert.equal(verbose.status, 0, verbose.stderr);
    assert.match(verbose.stdout, /^\/\/ ttsc: tsconfig=.* sites=0 emit=true$/m);
    assert.match(verbose.stdout, /^\/\/ ttsc: emitted=\d+ files$/m);
    assert.match(verbose.stdout, /^ {2}\+ .*main\.js$/m);
    assert.match(verbose.stdout, /^ {2}\+ .*other\.js$/m);
    // The list is derived from the parsed set; tsgo's own listing is internal.
    assert.ok(
      !verbose.stdout.includes("TSFILE:"),
      `raw listing leaked into user output:\n${verbose.stdout}`,
    );

    const plain = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.equal(plain.status, 0, plain.stderr);
    assert.equal(
      plain.stdout.trim(),
      "",
      `a build without a verbosity flag must stay silent:\n${plain.stdout}`,
    );
  };
