import assert from "node:assert/strict";
import path from "node:path";

import { TtscGraphLauncherArguments } from "../../../../packages/graph/src/TtscGraphLauncherArguments";
import { GraphArgumentError } from "../../../../packages/graph/src/launcherArgs";

/**
 * Verifies the launcher parsers reject twenty-eight malformed argument vectors
 * and forward valid dump argv unchanged.
 *
 * The view, dump and project-level parsers must throw GraphArgumentError on
 * missing, empty, unknown and out-of-domain values, while valid dump arguments
 * must pass validation and be forwarded as written.
 *
 * 1. Run each of the twenty-eight malformed vectors through the matching parser
 *    (view, dump or project) and require GraphArgumentError.
 * 2. Accept three valid dump vectors (separate flags, equals flags with
 *    --pretty=false, and --help) and require dumpVector to return them
 *    unchanged.
 * 3. Require dumpCompletion to map status 23 to code 23, a null status to code 1
 *    and a spawn error to code 1 with an owned diagnostic, and require
 *    dumpVector to append an artifacts path containing a space as one element.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphLauncherArguments.view, dump and project must each throw GraphArgumentError for the twenty-eight listed vectors; dump must accept and dumpVector must echo the three valid dump vectors; dumpCompletion must map status 23 to { code: 23 }, a null status to { code: 1 } and a spawn error to { code: 1, diagnostic: "@ttsc/graph: native write failure\n" }; dumpVector must append ["--artifacts", "artifact file.json"] after --pretty.
 * @evidence contracts/testing.md#independent-expectations The malformed vectors, the complete expected argv arrays, the status 23 and the diagnostic text are literals written in the test; no executable or product serializer produces them. The status-23 completion is asserted once per valid vector, so it is repeated rather than varied.
 * @evidence contracts/testing.md#distinguishing-cases Malformed inputs span missing values, empty equals values, unknown flags, non-numeric, negative, fractional, zero, unsafe and out-of-range numbers, and a value on a bare flag, contrasted with valid separate, equals and help spellings. Numeric status contrasts null status and a spawn error. Port 0 and 65535 pair with maxNodes 1 and 9007199254740991 to assert both accepted domain boundaries with literal full viewer coordinates.
 * @evidence contracts/testing.md#execution-ownership Calls the pure TtscGraphLauncherArguments operations and the GraphArgumentError type in the test process; no child process, native artifact or installed consumer is involved.
 */
export async function test_ttscgraph_launcher_rejects_malformed_arguments(): Promise<void> {
  const root = path.resolve("launcher-coordinate");
  const malformed = [
    ["view", "--max-nodes", "oops"],
    ["view", "--max-nodes=Infinity"],
    ["view", "--max-nodes", "9007199254740992"],
    ["view", "--max-nodes=-1"],
    ["view", "--max-nodes", "0"],
    ["view", "--max-nodes", "1.5"],
    ["view", "--max-nodes"],
    ["view", "--port", "oops"],
    ["view", "--port=Infinity"],
    ["view", "--port=-1"],
    ["view", "--port", "65536"],
    ["view", "--port"],
    ["view", "--cwd="],
    ["view", "--cwd"],
    ["view", "--tsconfig"],
    ["view", "--tsconfig="],
    ["view", "-p"],
    ["view", "--no-open=true"],
    ["view", "--unknown-flag"],
    ["--cxd", root],
    ["--cwd"],
    ["--tsconfig"],
    ["--tsconfig="],
    ["--nope"],
    ["dump", "--cxd", root],
    ["dump", "--cwd"],
    ["dump", "--tsconfig"],
    ["dump", "--tsconfig="],
  ];
  const errors: unknown[] = [];
  for (const args of malformed) {
    try {
      assert.throws(
        () => {
          if (args[0] === "view")
            return TtscGraphLauncherArguments.view(args.slice(1));
          if (args[0] === "dump")
            return TtscGraphLauncherArguments.dump(args.slice(1));
          return TtscGraphLauncherArguments.project(args);
        },
        GraphArgumentError,
        args.join(" "),
      );
    } catch (error) {
      errors.push(error);
    }
  }
  for (const args of [
    ["dump", "--cwd", root, "--tsconfig", "project.json", "--pretty"],
    ["dump", `--cwd=${root}`, "--tsconfig=project.json", "--pretty=false"],
    ["dump", "--help"],
  ]) {
    try {
      TtscGraphLauncherArguments.dump(args.slice(1));
      assert.deepEqual(
        TtscGraphLauncherArguments.dumpVector(args.slice(1), null),
        args,
      );
      assert.deepEqual(
        TtscGraphLauncherArguments.dumpCompletion({ status: 23 }),
        { code: 23 },
      );
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    for (const [port, maxNodes] of [
      [0, 1],
      [65535, 9007199254740991],
    ]) {
      assert.deepEqual(
        TtscGraphLauncherArguments.view([
          "--cwd",
          root,
          "--port",
          String(port),
          "--max-nodes",
          String(maxNodes),
          "--no-open",
        ]),
        { cwd: root, tsconfig: "tsconfig.json", port, maxNodes, open: false },
      );
    }
    assert.deepEqual(
      TtscGraphLauncherArguments.dumpCompletion({ status: null }),
      { code: 1 },
    );
    assert.deepEqual(
      TtscGraphLauncherArguments.dumpCompletion({
        status: null,
        error: new Error("native write failure"),
      }),
      { code: 1, diagnostic: "@ttsc/graph: native write failure\n" },
    );
    assert.deepEqual(
      TtscGraphLauncherArguments.dumpVector(["--pretty"], "artifact file.json"),
      ["dump", "--pretty", "--artifacts", "artifact file.json"],
    );
  } catch (error) {
    errors.push(error);
  }
  if (errors.length !== 0)
    throw new AggregateError(errors, "launcher source controls failed");
}
