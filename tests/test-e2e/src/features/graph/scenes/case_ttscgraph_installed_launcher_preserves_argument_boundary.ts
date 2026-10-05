import assert from "node:assert/strict";
import path from "node:path";

import {
  installedTargetBoundary,
  launch,
} from "../../../internal/graph/internal/installedTargetBoundary";

/**
 * Verifies installed CLI validation and actual dump dispatch remain connected.
 *
 * Portable source controls retain the full grammar and exact argv/status23
 * mapping. These representative installed controls retain the bin catch, lane
 * dispatch and real native producer connection without an executable sentinel.
 *
 * 1. Reject one malformed vector per lane with owned status-two diagnostics.
 * 2. Execute the original two valid project/pretty forms through the real
 *    producer.
 * 3. Contrast missing-install help and ordinary failure, then require real native
 *    help usage/status.
 *
 * @evidence contracts/testing.md#behavioral-verification Installed view/MCP/dump invalid vectors return status two and owned prefixes while an unavailable executable would instead cause native failure. Two real dump forms return status zero/current declarations and distinct pretty output; dump help retains native status two and stderr usage; missing-install help returns zero/qualified summary and ordinary missing-install dump remains failure one.
 * @evidence contracts/testing.md#independent-expectations Literal status two/zero, NativeTargetControl, project.json and native usage define independent installed outcomes. The source-unit matrix retains all twenty-eight invalid vectors, three exact forwarded argv arrays and native-status23 mapping.
 * @evidence contracts/testing.md#distinguishing-cases Three invalid lanes contrast real accepted separate/equals option forms and true/false pretty behavior; help contrasts project compilation. No Windows-only weakening or POSIX sentinel is used.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, this scene launches the workspace-resolved lib/bin.js against an actual native binary copied into the owned target package layout; it does not install a packed graph SDK. The authored source namespace unit owns complete portable token/vector/status semantics; these commands own the built launcher/native process connection.
 * @evidence contracts/e2e.md#necessary-boundary Actual bin argument catching, lane selection and native dump dispatch must connect in built workspace JavaScript and the authored target package layout; direct parsers cannot prove the process's literal status or stdout.
 * @evidence contracts/e2e.md#shared-execution All commands reuse the target-installed fixture/copy already shared by target-cwd and POSIX permission controls. Only one invalid representative per dispatch lane is retained; complete portable combinations and all three missing-install help aliases run in source units. One representative fallback and its ordinary-failure twin retain actual channel/status wiring.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Valid project.json is immutable and independent of invalid.json. Invalid commands use a missing executable coordinate as a counterexample to bypassed prevalidation; each synchronous call returns its direct command outcome; that return alone does not certify descendant termination or inherited-handle closure. TestProject owns shared temporary cleanup, subject to the existing unjoined-root retention and reuse-withdrawal authority.
 * @evidence contracts/e2e.md#preserved-coverage The exact direct owners are tests/test-graph/src/features/test_ttscgraph_launcher_rejects_malformed_arguments.ts (28 vectors, three full argv arrays and status23) and test_ttscgraph_dump_help_survives_a_missing_binary.ts (three fallback aliases and ordinary failure). The module features runner and existing test_*.ts claim select both; this static address/selection does not certify their runtime survival. Installed status-two/prefix and genuine accepted dump/help controls remain here; All original fallback aliases, usage/native-authority and ordinary-failure controls remain in the owning source unit plus representative installed connections; marker absence is replaced by the unavailable-native contrast and the verified parser-before-spawn consequence.
 */
export async function case_ttscgraph_installed_launcher_preserves_argument_boundary(): Promise<void> {
  const target = installedTargetBoundary();
  const errors: unknown[] = [];
  for (const args of [
    ["view", "--max-nodes", "oops"],
    ["--cxd", target.root],
    ["dump", "--cwd"],
  ]) {
    try {
      const result = launch(args, {
        cwd: target.elsewhere,
        graphBinary: path.join(target.elsewhere, "absent-native-binary"),
      });
      assert.equal(result.status, 2, `${args.join(" ")}\n${result.stderr}`);
      assert.match(result.stderr ?? "", /^@ttsc\/graph: /u);
    } catch (error) {
      errors.push(error);
    }
  }
  for (const [args, code, pattern] of [
    [["dump", "--help"], 0, /^Usage: ttsc-graph dump/mu],
    [["dump", "--pretty"], 1, /could not resolve the ttscgraph binary/u],
  ] as const) {
    try {
      const result = launch([...args], { cwd: target.empty, graphBinary: "" });
      assert.equal(result.status, code, result.stderr);
      assert.match(code === 0 ? result.stdout : result.stderr, pattern);
      if (code === 0) assert.match(result.stdout, /ttscgraph/u);
    } catch (error) {
      errors.push(error);
    }
  }
  const valid = [
    ["dump", "--cwd", target.root, "--tsconfig", "project.json", "--pretty"],
    [
      "dump",
      `--cwd=${target.root}`,
      "--tsconfig=project.json",
      "--pretty=false",
    ],
    ["dump", "--help"],
  ];
  for (const [index, args] of valid.entries()) {
    try {
      const result = launch(args, {
        cwd: target.elsewhere,
        graphBinary: target.binary,
      });
      if (index === 2) {
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr ?? "", /Usage of ttscgraph dump:/u);
        continue;
      }
      assert.equal(result.status, 0, `${args.join(" ")}\n${result.stderr}`);
      const dump = JSON.parse(result.stdout) as {
        tsconfig: string;
        nodes: { name: string }[];
      };
      assert.ok(dump.nodes.some((node) => node.name === "NativeTargetControl"));
      assert.equal(dump.tsconfig, "project.json");
      assert.equal(result.stdout.trim().split("\n").length > 1, index === 0);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length !== 0)
    throw new AggregateError(errors, "installed launcher controls failed");
}
