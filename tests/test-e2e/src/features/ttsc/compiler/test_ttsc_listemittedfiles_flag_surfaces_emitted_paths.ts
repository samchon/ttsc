import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies a forwarded `--listEmittedFiles` flag surfaces tsgo's file listing.
 *
 * Ttsc adds `--listEmittedFiles` to its own internal tsgo calls to learn the
 * emitted paths, then strips the resulting `TSFILE:` lines back out as noise.
 * That strip must not also eat the listing when the _user_ forwarded the flag —
 * otherwise `ttsc --listEmittedFiles` would print nothing at all.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --listEmittedFiles`.
 * 3. Assert a zero exit and a `TSFILE:` listing line in stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs emit with --listEmittedFiles and requires success plus TSFILE main.js output on stdout.
 * @evidence contracts/testing.md#independent-expectations The authored main.ts source maps to main.js under the project emit contract; the tsgo listing protocol prefixes emitted paths with TSFILE.
 * @evidence contracts/testing.md#distinguishing-cases The canonical mixed-case flag exercises forwarding and real emit listing; lowercase spelling is checked by its separate complementary entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named compiler feature and runs actual ttsc/tsgo emission.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must preserve native emitted-path stdout instead of consuming it for its own summary; direct argv parser tests cannot prove stream forwarding.
 * @evidence contracts/e2e.md#shared-execution One emit command supplies success/listing checks from the shared executables with no contributor build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject registers fresh source/config and initially absent output; synchronous process completion precedes stdout inspection and suite exit owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original success and TSFILE regex remain. The regex does not establish exact path identity or actual output contents.
 */
export const test_ttsc_listemittedfiles_flag_surfaces_emitted_paths = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_listemittedfiles_flag_surfaces_emitted_paths/inputs-1"));

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--listEmittedFiles"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /TSFILE:.*main\.js/);
};
