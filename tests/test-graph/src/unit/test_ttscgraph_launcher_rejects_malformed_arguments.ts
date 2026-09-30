import assert from "node:assert/strict";
import path from "node:path";

import { TtscGraphLauncherArguments } from "../../../../packages/graph/src/TtscGraphLauncherArguments";
import { GraphArgumentError } from "../../../../packages/graph/src/launcherArgs";

/**
 * Verifies every original malformed vector and exact dump-forwarding contract.
 *
 * Portable grammar and argv/status mapping do not need an executable sentinel.
 * These owning operations are consumed by the actual launcher before its native
 * work; the minimal real CLI batch retains status-two and native connections.
 *
 * 1. Reject all twenty-eight original malformed vectors with GraphArgumentError.
 * 2. Accept the three original dump spellings and preserve their complete native argv.
 * 3. Preserve literal native status23 and distinguish null status and actual spawn error.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored launcher grammar rejects all twenty-eight malformed vectors; dump validation and vector construction accept all three original spellings unchanged, and the actual completion owner preserves status23 while mapping missing status/error to failure one.
 * @evidence contracts/testing.md#independent-expectations Literal malformed inputs, complete argv arrays, GraphArgumentError and native status23 define independent grammar/vector/completion witnesses. No executable or product serializer creates these expectations.
 * @evidence contracts/testing.md#distinguishing-cases Missing/empty/unknown options, unsafe/noninteger/out-of-range numbers and flag values contrast valid pretty/help aliases. Numeric native status contrasts absent status and spawn error; installed CLI status-two and real-native status-zero remain in E2E.
 * @evidence contracts/testing.md#execution-ownership This src/unit entry imports the authored namespace and error type consumed by runGraph/view. Each literal vector/result is an input to its real pure operation; no child, native artifact, installed consumer or fabricated CLI output is used.
 */
export async function test_ttscgraph_launcher_rejects_malformed_arguments(): Promise<void> {
  const root = path.resolve("launcher-coordinate");
  const malformed = [
    ["view", "--max-nodes", "oops"], ["view", "--max-nodes=Infinity"],
    ["view", "--max-nodes", "9007199254740992"], ["view", "--max-nodes=-1"],
    ["view", "--max-nodes", "0"], ["view", "--max-nodes", "1.5"], ["view", "--max-nodes"],
    ["view", "--port", "oops"], ["view", "--port=Infinity"], ["view", "--port=-1"],
    ["view", "--port", "65536"], ["view", "--port"], ["view", "--cwd="], ["view", "--cwd"],
    ["view", "--tsconfig"], ["view", "--tsconfig="], ["view", "-p"],
    ["view", "--no-open=true"], ["view", "--unknown-flag"],
    ["--cxd", root], ["--cwd"], ["--tsconfig"], ["--tsconfig="], ["--nope"],
    ["dump", "--cxd", root], ["dump", "--cwd"], ["dump", "--tsconfig"], ["dump", "--tsconfig="],
  ];
  const errors: unknown[] = [];
  for (const args of malformed) {
    try {
      assert.throws(() => {
        if (args[0] === "view") return TtscGraphLauncherArguments.view(args.slice(1));
        if (args[0] === "dump") return TtscGraphLauncherArguments.dump(args.slice(1));
        return TtscGraphLauncherArguments.project(args);
      }, GraphArgumentError, args.join(" "));
    } catch (error) { errors.push(error); }
  }
  for (const args of [
    ["dump", "--cwd", root, "--tsconfig", "project.json", "--pretty"],
    ["dump", `--cwd=${root}`, "--tsconfig=project.json", "--pretty=false"],
    ["dump", "--help"],
  ]) {
    try {
      TtscGraphLauncherArguments.dump(args.slice(1));
      assert.deepEqual(TtscGraphLauncherArguments.dumpVector(args.slice(1), null), args);
      assert.deepEqual(TtscGraphLauncherArguments.dumpCompletion({ status: 23 }), { code: 23 });
    } catch (error) { errors.push(error); }
  }
  try {
    assert.deepEqual(TtscGraphLauncherArguments.dumpCompletion({ status: null }), { code: 1 });
    assert.deepEqual(TtscGraphLauncherArguments.dumpCompletion({ status: null, error: new Error("native write failure") }), { code: 1, diagnostic: "@ttsc/graph: native write failure\n" });
    assert.deepEqual(TtscGraphLauncherArguments.dumpVector(["--pretty"], "artifact file.json"), ["dump", "--pretty", "--artifacts", "artifact file.json"]);
  } catch (error) { errors.push(error); }
  if (errors.length !== 0) throw new AggregateError(errors, "launcher source controls failed");
}
