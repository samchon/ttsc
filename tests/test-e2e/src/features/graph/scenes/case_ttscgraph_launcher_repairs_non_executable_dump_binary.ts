import fs from "node:fs";

import { installedTargetBoundary } from "../../../internal/graph/internal/installedTargetBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

/**
 * Verifies graph launcher repairs a non-executable dump binary.
 *
 * Platform package tarballs can lose POSIX executable bits when they are packed
 * from a non-POSIX host. The launcher must recover before spawning ttscgraph so
 * installed @ttsc/graph users do not hit EACCES on the first dump.
 *
 * 1. Borrow the shared target-installed real native binary copy and its cold 0644
 *    receipt.
 * 2. Run the @ttsc/graph dump pass-through against that binary.
 * 3. Assert a real compiler declaration was produced and the binary gained an
 *    executable bit.
 *
 * @evidence contracts/testing.md#behavioral-verification On POSIX the installed launcher runs a fixture binary initially at mode 0644, produces the literal NativeTargetControl declaration and leaves executable permission bits set.
 * @evidence contracts/testing.md#independent-expectations Literal non-executable mode, successful exit, literal compiler declaration and nonzero executable-bit mask independently require actual permission repair and subsequent execution.
 * @evidence contracts/testing.md#distinguishing-cases Readable-but-not-executable input must change to executable before dump. This existing case returns on Windows and does not certify Windows chmod behavior.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_launcher_repairs_non_executable_dump_binary uses the workspace-resolved built launcher and the real binary copied into the owned target package layout, not a packed graph SDK installation; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real POSIX access/chmod and child execution must connect through the launcher; an in-memory permission predicate cannot prove the repaired file was runnable.
 * @evidence contracts/e2e.md#shared-execution The target-cwd and permission entries share one authored target package layout, one real binary copy and its first dump receipt. Only this copy begins at 0644; the canonical producer remains immutable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared preparation records mode before and after its sole first dump. Receipt reuse retains the cold 0644 distinction regardless of case order; the synchronous call supplies the direct command outcome, not proof of all descendant termination or inherited-handle closure. TestProject owns project removal subject to the existing unjoined-root retention and reuse-withdrawal authority.
 * @evidence contracts/e2e.md#preserved-coverage Original status-zero and repaired-mode assertions remain with the original POSIX scope. The sentinel marker execution proof becomes an actual native-produced declaration; no fake producer or permission capability stands in for execution.
 */
export const case_ttscgraph_launcher_repairs_non_executable_dump_binary =
  () => {
    if (process.platform === "win32") return;
    const {
      binary,
      beforeMode,
      afterMode,
      dump: result,
    } = installedTargetBoundary();
    assert.equal(
      beforeMode & 0o111,
      0,
      "the owned binary must begin non-executable",
    );
    assert.equal(
      result.status,
      0,
      `graph dump should execute the repaired binary\nstderr: ${result.stderr}`,
    );
    const dump = JSON.parse(result.stdout) as { nodes: { name: string }[] };
    assert.ok(dump.nodes.some((node) => node.name === "NativeTargetControl"));
    assert.notEqual(
      afterMode & 0o111,
      0,
      "launcher should repair executable bits before its first spawn",
    );
    assert.notEqual(
      fs.statSync(binary).mode & 0o111,
      0,
      "the repaired copy must remain executable",
    );
  };
