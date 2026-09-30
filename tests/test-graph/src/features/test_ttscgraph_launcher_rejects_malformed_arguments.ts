import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { assert, resolveGraphLauncher } from "../internal/ttsgraph";

/**
 * Verifies the graph launcher rejects malformed arguments before starting work.
 *
 * The viewer's numeric budget used JavaScript coercion, while the MCP and dump
 * lanes ignored unknown or dangling project flags. A malformed option could
 * therefore remove the viewer cap or start a server for the process directory.
 * Every invalid invocation below points at a sentinel binary, so a usage error
 * must return before native resolution or graph construction can reach it.
 *
 * 1. Run malformed viewer, MCP, and dump argument vectors through the built CLI.
 * 2. Assert each exits with a usage error and leaves the sentinel untouched.
 * 3. On executable hosts, run valid dump forms and preserve the native exit code
 *    and forwarded arguments.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed launcher rejects twenty-eight malformed dump/view/MCP vectors with status two and an owned argument prefix before a sentinel runs; valid POSIX dump vectors preserve exact argv and status 23.
 * @evidence contracts/testing.md#independent-expectations Literal malformed vectors, status two and an absent sentinel marker distinguish pre-spawn validation; literal valid argv vectors are independent forwarding controls.
 * @evidence contracts/testing.md#distinguishing-cases Missing values, unknown options, invalid numeric forms, paths and --no-open=true contrast accepted dump spellings; the valid sentinel execution control is POSIX-only.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_launcher_rejects_malformed_arguments runs installed CLI commands and their real resolution/spawn consequences; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary CLI parsing, command dispatch and native spawn prevention must assemble in the installed entrypoint; direct parsing cannot prove the sentinel stayed untouched.
 * @evidence contracts/e2e.md#shared-execution All vectors reuse one installed sentinel/project; each launcher command currently starts its own Node process. Invalid requests do not require compiler work, and further process batching is not implemented.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The marker is reset for each vector so an earlier accepted command cannot mask a forbidden spawn; synchronous commands join and tracked project cleanup owns the fixtures.
 * @evidence contracts/e2e.md#preserved-coverage Every malformed vector/status/prefix/no-marker assertion and supported valid forwarding vector is preserved; no input is skipped to shorten this documentation change.
 */
export const test_ttscgraph_launcher_rejects_malformed_arguments = () => {
  const root = TestProject.tmpdir("ttscgraph-launcher-args-");
  const marker = path.join(root, "native-marker.json");
  const binary = path.join(root, "ttscgraph");
  fs.writeFileSync(
    binary,
    [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "fs.writeFileSync(process.env.TTSCGRAPH_MARKER, JSON.stringify(process.argv.slice(2)));",
      "process.exit(23);",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.chmodSync(binary, 0o755);

  const run = (args: string[]) =>
    TestProject.spawn(process.execPath, [resolveGraphLauncher(), ...args], {
      cwd: root,
      env: { TTSC_GRAPH_BINARY: binary, TTSCGRAPH_MARKER: marker },
      timeout: 30_000,
    });

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
  for (const args of malformed) {
    fs.rmSync(marker, { force: true });
    const result = run(args);
    assert.equal(
      result.status,
      2,
      `${args.join(" ")} exits before graph work\nstderr: ${result.stderr}`,
    );
    assert.match(
      result.stderr ?? "",
      /^@ttsc\/graph: /,
      `${args.join(" ")} reports a launcher usage error`,
    );
    assert.equal(
      fs.existsSync(marker),
      false,
      `${args.join(" ")} does not invoke the native graph binary`,
    );
  }

  if (process.platform !== "win32") {
    for (const args of [
      ["dump", "--cwd", root, "--tsconfig", "project.json", "--pretty"],
      ["dump", `--cwd=${root}`, "--tsconfig=project.json", "--pretty=false"],
      ["dump", "--help"],
    ]) {
      fs.rmSync(marker, { force: true });
      const result = run(args);
      assert.equal(
        result.status,
        23,
        `${args.join(" ")} preserves the native exit code\nstderr: ${result.stderr}`,
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(marker, "utf8")),
        args,
        `${args.join(" ")} preserves the native dump argv`,
      );
    }
  }
};
