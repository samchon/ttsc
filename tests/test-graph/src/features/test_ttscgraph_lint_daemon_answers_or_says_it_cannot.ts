import assert from "node:assert/strict";
import { TtscLintDaemonState } from "../../../../packages/graph/src/model/TtscLintDaemonState";
import { TtscGraphNativeArguments } from "../../../../packages/graph/src/model/TtscGraphNativeArguments";
import type { TtscGraphLinePeer } from "../../../../packages/graph/src/model/TtscGraphLinePeer";

/** Declared port recordings only; input lines/events are supplied by each case. */
const fixture = () => {
  const ports: { events: TtscGraphLinePeer.Events; writes: { verb: string; invalidate: boolean }[]; closed: number }[] = [];
  const daemon = new TtscLintDaemonState((events) => {
    const port = { events, writes: [] as { verb: string; invalidate: boolean }[], closed: 0 };
    ports.push(port);
    return { stderr: "", alive: () => port.closed === 0, write: (line, done) => { port.writes.push(JSON.parse(line)); done(); }, close: () => { port.closed++; } };
  });
  return { daemon, ports };
};

const admitted = async (ports: ReturnType<typeof fixture>["ports"], count: number) => {
  for (let turn = 0; turn < 20; turn++) {
    const port = ports[0];
    if (port !== undefined && port.writes.length >= count) return port;
    await Promise.resolve();
  }
  assert.fail("daemon queue did not admit request");
};

/**
 * Verifies the lint daemon state returns supported replies, answers null when it cannot, and serializes concurrent asks.
 *
 * A null answer means the caller must run the direct command; it must never be
 * mistaken for an empty project. Replies carry no request id, so a second
 * caller must wait until the first reply has been consumed.
 *
 * 1. Ask two supported verbs and check each reply's content, the invalidate flag
 *    written for each, and the lint argv builder's flags.
 * 2. Answer a verb with a nonzero code, and exit the transport before any reply;
 *    require null for that ask and for every later ask, with no new port.
 * 3. Ask two verbs at once and require the second request line to be written
 *    only after the first reply arrives.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscLintDaemonState.ask must return the parsed result text of a code-0 reply for "project-inputs" and "graph-nodes" and write [verb, invalidate] pairs [["project-inputs", true], ["graph-nodes", false]]; a code-1 reply must yield null, close the port once and make the next ask null; an exit event must yield null for the pending and later asks; and two simultaneous asks must be written one at a time in order. TtscGraphNativeArguments.lint must start with "lsp-serve" and carry --cwd=, --tsconfig=, --plugins-json= and --project-context-json=.
 * @evidence contracts/testing.md#independent-expectations The verbs, the "servedBy" marker, the invalidate flags, the reply codes, the expected null outcomes, the port count of one and the close count of one are literals authored in the test; the replies are JSON lines written by the test through the port events, not produced by a daemon.
 * @evidence contracts/testing.md#distinguishing-cases Five scenario families contrast a served reply, a declined reply (code 1), a transport exit with no reply, and concurrent asks; the concurrent scenario shows the second write absent after five microtask turns and present only after the first reply. Malformed JSON and a reply without a numeric code each return null, retire the port once and prevent another port. Write failure is not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscLintDaemonState and TtscGraphNativeArguments.lint in the test process against recorded line ports that the test feeds JSON lines and exit events through the declared events; no lint sidecar process, direct-command fallback or real transport is involved.
 */
export async function test_ttscgraph_lint_daemon_answers_or_says_it_cannot(): Promise<void> {
  const errors: unknown[] = [];
  for (const run of [verifyServes, verifyRejectedVerb, verifyMissingServe, verifyConcurrent, verifyMalformedReplies]) {
    try { await run(); } catch (error) { errors.push(error); }
  }
  if (errors.length !== 0) throw new AggregateError(errors, "lint daemon state scenarios failed");
}

async function verifyServes(): Promise<void> {
  const { daemon, ports } = fixture();
  try {
    const first = daemon.ask("project-inputs", true);
    const port = await admitted(ports, 1);
    port.events.line(JSON.stringify({ code: 0, result: { servedBy: "daemon", verb: "project-inputs" } }));
    const inputs = await first;
    assert.notEqual(inputs, null);
    assert.equal(JSON.parse(inputs!).servedBy, "daemon");
    const second = daemon.ask("graph-nodes", false);
    await admitted(ports, 2);
    port.events.line(JSON.stringify({ code: 0, result: { servedBy: "daemon", verb: "graph-nodes" } }));
    assert.equal(JSON.parse((await second)!).verb, "graph-nodes");
    assert.equal(ports.length, 1);
    const args = TtscGraphNativeArguments.lint("/fixture", "tsconfig.json", "[]", '{"physicalProjectRoot":"/fixture"}');
    assert.equal(args[0], "lsp-serve");
    for (const flag of ["--cwd=", "--tsconfig=", "--plugins-json=", "--project-context-json="]) assert.equal(args.some((arg) => arg.startsWith(flag)), true);
    assert.deepEqual(port.writes.map((request) => [request.verb, request.invalidate]), [["project-inputs", true], ["graph-nodes", false]]);
  } finally { await daemon.close(); }
}

async function verifyRejectedVerb(): Promise<void> {
  const { daemon, ports } = fixture();
  try {
    const initial = daemon.ask("project-inputs", true);
    const port = await admitted(ports, 1);
    port.events.line('{"code":0,"result":{"verb":"project-inputs"}}');
    assert.notEqual(await initial, null);
    const rejected = daemon.ask("graph-nodes", false);
    await admitted(ports, 2);
    port.events.line('{"code":1,"result":null}');
    assert.equal(await rejected, null);
    assert.equal(await daemon.ask("project-inputs", true), null);
    assert.equal(ports.length, 1);
    assert.equal(port.closed, 1);
  } finally { await daemon.close(); }
}

async function verifyMissingServe(): Promise<void> {
  const { daemon, ports } = fixture();
  try {
    const first = daemon.ask("project-inputs", true);
    const port = await admitted(ports, 1);
    port.events.exit(2, null);
    assert.equal(await first, null);
    assert.equal(await daemon.ask("graph-nodes", false), null);
    assert.equal(ports.length, 1);
  } finally { await daemon.close(); }
}

async function verifyConcurrent(): Promise<void> {
  const { daemon, ports } = fixture();
  try {
    const first = daemon.ask("project-inputs", true);
    const second = daemon.ask("graph-nodes", false);
    const port = await admitted(ports, 1);
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
    assert.equal(port.writes.length, 1, "second request was written before first reply");
    port.events.line('{"code":0,"result":{"verb":"project-inputs"}}');
    assert.equal(JSON.parse((await first)!).verb, "project-inputs");
    await admitted(ports, 2);
    port.events.line('{"code":0,"result":{"verb":"graph-nodes"}}');
    assert.equal(JSON.parse((await second)!).verb, "graph-nodes");
    assert.deepEqual(port.writes.map((request) => request.verb), ["project-inputs", "graph-nodes"]);
    assert.equal(ports.length, 1);
  } finally { await daemon.close(); }
}

/** Invalid JSON and absent reply codes retire ownership rather than succeed. */
async function verifyMalformedReplies(): Promise<void> {
  const errors: unknown[] = [];
  for (const line of ["not JSON", '{"result":{}}']) {
    const { daemon, ports } = fixture();
    try {
      const pending = daemon.ask("project-inputs", true);
      const port = await admitted(ports, 1);
      port.events.line(line);
      assert.equal(await pending, null);
      assert.equal(await daemon.ask("graph-nodes", false), null);
      assert.equal(port.closed, 1);
      assert.equal(ports.length, 1);
    } catch (error) { errors.push(error); }
    finally { await daemon.close(); }
  }
  if (errors.length) throw new AggregateError(errors, "malformed daemon replies");
}
