import assert from "node:assert/strict";
import path from "node:path";

import { installedTargetBoundary, launch } from "../internal/installedTargetBoundary";

/**
 * Verifies installed CLI validation and actual dump dispatch remain connected.
 *
 * Portable source controls retain the full grammar and exact argv/status23
 * mapping. These representative installed controls retain the bin catch, lane
 * dispatch and real native producer connection without an executable sentinel.
 *
 * 1. Reject one malformed vector per lane with owned status-two diagnostics.
 * 2. Execute the original two valid project/pretty forms through the real producer.
 * 3. Execute dump help through that same real binary and require its native usage and exit status.
 *
 * @evidence contracts/testing.md#behavioral-verification Installed view/MCP/dump invalid vectors return status two and owned prefixes while an unavailable executable would instead cause native failure. Two real dump forms return status zero/current declarations and distinct pretty output; dump help retains native status two and stderr usage.
 * @evidence contracts/testing.md#independent-expectations Literal status two/zero, NativeTargetControl, project.json and native usage define independent installed outcomes. The source-unit matrix retains all twenty-eight invalid vectors, three exact forwarded argv arrays and native-status23 mapping.
 * @evidence contracts/testing.md#distinguishing-cases Three invalid lanes contrast real accepted separate/equals option forms and true/false pretty behavior; help contrasts project compilation. No Windows-only weakening or POSIX sentinel is used.
 * @evidence contracts/testing.md#execution-ownership This features export drives the installed bin/launcher against an actual native binary copy. The authored source namespace unit owns complete portable token/vector/status semantics; these commands own the shipped connection.
 * @evidence contracts/e2e.md#necessary-boundary Actual bin argument catching, lane selection and native dump dispatch must connect in generated installed JavaScript; direct parsers cannot prove the process's literal status or stdout.
 * @evidence contracts/e2e.md#shared-execution All commands reuse the target-installed fixture/copy already shared by target-cwd and POSIX permission controls. Only one invalid representative per dispatch lane is retained; complete portable combinations run in one source-unit process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Valid project.json is immutable and independent of invalid.json. Invalid commands use a missing executable coordinate as a counterexample to bypassed prevalidation; each synchronous command joins and TestProject owns shared temporary cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original malformed inputs, exact argv and native-status23 assertions remain in the actual owning source unit. Installed status-two/prefix and genuine accepted dump/help controls remain here; marker absence is replaced by the unavailable-native contrast and the verified parser-before-spawn consequence.
 */
export async function test_ttscgraph_installed_launcher_preserves_argument_boundary(): Promise<void> {
  const target = installedTargetBoundary();
  const errors: unknown[] = [];
  for (const args of [["view", "--max-nodes", "oops"], ["--cxd", target.root], ["dump", "--cwd"]]) {
    try {
      const result = launch(args, { cwd: target.elsewhere, graphBinary: path.join(target.elsewhere, "absent-native-binary") });
      assert.equal(result.status, 2, `${args.join(" ")}\n${result.stderr}`);
      assert.match(result.stderr ?? "", /^@ttsc\/graph: /u);
    } catch (error) { errors.push(error); }
  }
  const valid = [
    ["dump", "--cwd", target.root, "--tsconfig", "project.json", "--pretty"],
    ["dump", `--cwd=${target.root}`, "--tsconfig=project.json", "--pretty=false"],
    ["dump", "--help"],
  ];
  for (const [index, args] of valid.entries()) {
    try {
      const result = launch(args, { cwd: target.elsewhere, graphBinary: target.binary });
      if (index === 2) {
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr ?? "", /Usage of ttscgraph dump:/u);
        continue;
      }
      assert.equal(result.status, 0, `${args.join(" ")}\n${result.stderr}`);
      const dump = JSON.parse(result.stdout) as { tsconfig: string; nodes: { name: string }[] };
      assert.ok(dump.nodes.some((node) => node.name === "NativeTargetControl"));
      assert.equal(dump.tsconfig, "project.json");
      assert.equal(result.stdout.trim().split("\n").length > 1, index === 0);
    } catch (error) { errors.push(error); }
  }
  if (errors.length !== 0) throw new AggregateError(errors, "installed launcher controls failed");
}
