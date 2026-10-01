import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";

import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies positional `ttsc <file>` writes its output at the same place when
 * the cwd reaches the project through a link.
 *
 * The project resolves to its physical directory, and the output mirrored the
 * requested file below that `rootDir` with `path.relative`, which compared the
 * physical `rootDir` with the file as the cwd spelled it. Through a link the
 * file seemed to lie outside `rootDir`, so `ttsc src/index.ts` wrote
 * `lib/index.js` instead of `lib/src/index.js`, and printed it as a path
 * walking out through the link and back in. macOS reaches every project in its
 * temporary directory that way, through `/var`.
 *
 * 1. Create a project with `outDir: "lib"` and `src/index.ts`, and a link to it.
 * 2. Run `ttsc src/index.ts` with the link as the cwd.
 * 3. Assert the output is `lib/src/index.js`, named relative to the cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification Linked cwd positional index.ts exits zero, creates lib/src/index.js but not lib/index.js, and prints relative mirrored path.
 * @evidence contracts/testing.md#independent-expectations Authored src location under effective project root independently fixes target; lexical alias must not flatten layout.
 * @evidence contracts/testing.md#distinguishing-cases Physical project reached by junction/link cwd; no explicit rootDir.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_mirrors_its_source_through_a_linked_cwd is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Real linked filesystem identity and native-output lookup reach launcher materialization and reporting.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Linked cwd positional index.ts exits zero, creates lib/src/index.js but not lib/index.js, and prints relative mirrored path. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_mirrors_its_source_through_a_linked_cwd =
  (): void => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_single_file_mirrors_its_source_through_a_linked_cwd/inputs-1"));
    const link = path.join(TestProject.tmpdir("ttsc-linked-cwd-"), "project");
    fs.symlinkSync(root, link, "junction");

    const result = spawn(ttscBin, ["--cwd", link, "src/index.ts"], {
      cwd: link,
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(
      fs.existsSync(path.join(root, "lib", "src", "index.js")),
      true,
      result.stdout,
    );
    assert.equal(fs.existsSync(path.join(root, "lib", "index.js")), false);
    assert.equal(result.stdout.trim(), path.join("lib", "src", "index.js"));
  };
