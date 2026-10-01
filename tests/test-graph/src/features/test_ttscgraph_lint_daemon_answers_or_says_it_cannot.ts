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
 * Verifies supported, unavailable and concurrent lint daemon reply ownership.
 *
 * Null must request the actual direct-command fallback rather than describe an
 * empty project. Since replies lack ids, simultaneous callers must remain
 * serialized until the first reply has been consumed.
 *
 * 1. Submit two supported verbs and verify reply identity and invalidate flags.
 * 2. Reject a verb or end the transport and require permanent null fallback.
 * 3. Submit simultaneous callers and verify no second write precedes the first reply.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored daemon state parses explicit supported replies, retires nonzero and exited ports, and serializes two concurrent asks; actual lint argv builder retains all original project/context flags.
 * @evidence contracts/testing.md#independent-expectations Literal verbs, servedBy marker, invalidate flags, null outcomes and one opener/no-respawn counts are independent of returned state. No line-generating peer or executable supplies them.
 * @evidence contracts/testing.md#distinguishing-cases All four original serve/reject/no-serve/concurrent scenarios remain; the concurrent scenario additionally proves the second write is absent before the first response.
 * @evidence contracts/testing.md#execution-ownership This src/features entry imports actual authored daemon state and argument builder. Caller-authored JSON lines reach its real parser through declared events; actual process I/O remains in the default adapter E2E boundary.
 */
export async function test_ttscgraph_lint_daemon_answers_or_says_it_cannot(): Promise<void> {
  const errors: unknown[] = [];
  for (const run of [verifyServes, verifyRejectedVerb, verifyMissingServe, verifyConcurrent]) {
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
  } finally { daemon.close(); }
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
  } finally { daemon.close(); }
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
  } finally { daemon.close(); }
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
  } finally { daemon.close(); }
}
