import assert from "node:assert/strict";

import type { TtscGraphLinePeer } from "../../../../packages/graph/src/model/TtscGraphLinePeer";
import { TtscGraphNativeArguments } from "../../../../packages/graph/src/model/TtscGraphNativeArguments";
import { TtscLintDaemonState } from "../../../../packages/graph/src/model/TtscLintDaemonState";

/** Declared port recordings only; input lines/events are supplied by each case. */
const fixture = (retirement?: Promise<void>) => {
  const ports: {
    events: TtscGraphLinePeer.Events;
    writes: { verb: string; invalidate: boolean }[];
    closed: number;
  }[] = [];
  const daemon = new TtscLintDaemonState((events) => {
    const port = {
      events,
      writes: [] as { verb: string; invalidate: boolean }[],
      closed: 0,
    };
    ports.push(port);
    return {
      stderr: "",
      alive: () => port.closed === 0,
      write: (line, done) => {
        port.writes.push(JSON.parse(line));
        done();
      },
      close: () => {
        port.closed++;
        return retirement;
      },
    };
  });
  return { daemon, ports };
};

const admitted = async (
  ports: ReturnType<typeof fixture>["ports"],
  count: number,
) => {
  for (let turn = 0; turn < 20; turn++) {
    const port = ports[0];
    if (port !== undefined && port.writes.length >= count) return port;
    await Promise.resolve();
  }
  assert.fail("daemon queue did not admit request");
};

/**
 * Verifies the lint daemon state returns supported replies, answers null when
 * it cannot, and serializes concurrent asks.
 *
 * A null answer means the caller must run the direct command; it must never be
 * mistaken for an empty project. Replies carry no request id, so a second
 * caller must wait until the first reply has been consumed.
 *
 * 1. Ask two supported verbs and check each reply's content, the invalidate flag
 *    written for each, and the lint argv builder's flags.
 * 2. Decline a verb, or supply exit(2, null) without a reply; require pending and
 *    later asks to wait for release, then return null only after joined
 *    completion, or preserve an unjoined failure with no new port.
 * 3. Ask two verbs at once and require the second request line to be written only
 *    after the first reply arrives.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscLintDaemonState.ask returns parsed supported code-0 replies and literal invalidate flags, while a code-1 reply retires once and yields null. An unsupported-sidecar exit(2, null) keeps pending and queued fallback asks unsettled until release resolves, then yields null without another port; rejected release propagates the original Error to pending, queued and subsequent asks and close. Concurrent supported asks write one at a time. Native lint arguments retain lsp-serve and the four target/config/plugin/context flags.
 * @evidence contracts/testing.md#independent-expectations Verbs, servedBy marker, flags, reply/exit codes, null results, opener/close count one and unchanged write count one are authored literals. Deferred release and original unjoined Error are declared transport inputs; replies are authored JSON lines, not daemon output. Null is the owning fallback signal, not proof of actual direct-command execution.
 * @evidence contracts/testing.md#distinguishing-cases Served, declined, malformed, no-numeric-code and concurrent replies remain covered. Exit without a reply now contrasts delayed joined numeric-nonzero release with unjoined rejection; neither publishes fallback nor writes a queued ask before release. A separate retirement decision case qualifies zero/nonzero, signal, forced, unknown and transport-error coordinates; write failure is not exercised here.
 * @evidence contracts/testing.md#execution-ownership Runs TtscLintDaemonState and TtscGraphNativeArguments.lint in the test process against recorded line ports that the test feeds JSON lines and exit events through the declared events; no lint sidecar process, direct-command fallback or real transport is involved.
 */
export async function test_ttscgraph_lint_daemon_answers_or_says_it_cannot(): Promise<void> {
  const errors: unknown[] = [];
  for (const run of [
    verifyServes,
    verifyRejectedVerb,
    verifyMissingServe,
    verifyConcurrent,
    verifyMalformedReplies,
  ]) {
    try {
      await run();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length !== 0)
    throw new AggregateError(errors, "lint daemon state scenarios failed");
}

async function verifyServes(): Promise<void> {
  const { daemon, ports } = fixture();
  try {
    const first = daemon.ask("project-inputs", true);
    const port = await admitted(ports, 1);
    port.events.line(
      JSON.stringify({
        code: 0,
        result: { servedBy: "daemon", verb: "project-inputs" },
      }),
    );
    const inputs = await first;
    assert.notEqual(inputs, null);
    assert.equal(JSON.parse(inputs!).servedBy, "daemon");
    const second = daemon.ask("graph-nodes", false);
    await admitted(ports, 2);
    port.events.line(
      JSON.stringify({
        code: 0,
        result: { servedBy: "daemon", verb: "graph-nodes" },
      }),
    );
    assert.equal(JSON.parse((await second)!).verb, "graph-nodes");
    assert.equal(ports.length, 1);
    const args = TtscGraphNativeArguments.lint(
      "/fixture",
      "tsconfig.json",
      "[]",
      '{"physicalProjectRoot":"/fixture"}',
    );
    assert.equal(args[0], "lsp-serve");
    for (const flag of [
      "--cwd=",
      "--tsconfig=",
      "--plugins-json=",
      "--project-context-json=",
    ])
      assert.equal(
        args.some((arg) => arg.startsWith(flag)),
        true,
      );
    assert.deepEqual(
      port.writes.map((request) => [request.verb, request.invalidate]),
      [
        ["project-inputs", true],
        ["graph-nodes", false],
      ],
    );
  } finally {
    await daemon.close();
  }
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
  } finally {
    await daemon.close();
  }
}

async function verifyMissingServe(): Promise<void> {
  const failures: Error[] = [];
  for (const outcome of ["joined", "unjoined"] as const) {
    let release!: () => void;
    let refuse!: (error: Error) => void;
    const retirement = new Promise<void>((resolve, reject) => {
      release = resolve;
      refuse = reject;
    });
    const { daemon, ports } = fixture(retirement);
    try {
      const first = daemon.ask("project-inputs", true);
      const port = await admitted(ports, 1);
      const later = daemon.ask("graph-nodes", false);
      let settlements = 0;
      for (const ask of [first, later])
        void ask.then(
          () => {
            settlements++;
          },
          () => {
            settlements++;
          },
        );
      port.events.exit(2, null);
      for (let turn = 0; turn < 20; turn++) await Promise.resolve();
      assert.equal(settlements, 0, "fallback published before release");
      assert.equal(port.writes.length, 1, "queued ask reached failed daemon");
      assert.equal(port.closed, 1);
      if (outcome === "joined") {
        release();
        assert.equal(await first, null);
        assert.equal(await later, null);
        assert.equal(await daemon.ask("project-inputs", true), null);
        await daemon.close();
      } else {
        const unjoined = new Error("authored lint release could not be joined");
        refuse(unjoined);
        await assert.rejects(first, (error) => error === unjoined);
        await assert.rejects(later, (error) => error === unjoined);
        await assert.rejects(
          daemon.ask("project-inputs", true),
          (error) => error === unjoined,
        );
        await assert.rejects(daemon.close(), (error) => error === unjoined);
      }
      assert.equal(ports.length, 1);
      assert.equal(port.closed, 1);
      assert.equal(port.writes.length, 1);
    } catch (error) {
      failures.push(
        new Error(`${outcome}: ${String(error)}`, { cause: error }),
      );
    } finally {
      release();
      await daemon.close().catch(() => undefined);
    }
  }
  if (failures.length > 0)
    throw new AggregateError(failures, "missing serve release matrix failed");
}

async function verifyConcurrent(): Promise<void> {
  const { daemon, ports } = fixture();
  try {
    const first = daemon.ask("project-inputs", true);
    const second = daemon.ask("graph-nodes", false);
    const port = await admitted(ports, 1);
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
    assert.equal(
      port.writes.length,
      1,
      "second request was written before first reply",
    );
    port.events.line('{"code":0,"result":{"verb":"project-inputs"}}');
    assert.equal(JSON.parse((await first)!).verb, "project-inputs");
    await admitted(ports, 2);
    port.events.line('{"code":0,"result":{"verb":"graph-nodes"}}');
    assert.equal(JSON.parse((await second)!).verb, "graph-nodes");
    assert.deepEqual(
      port.writes.map((request) => request.verb),
      ["project-inputs", "graph-nodes"],
    );
    assert.equal(ports.length, 1);
  } finally {
    await daemon.close();
  }
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
    } catch (error) {
      errors.push(error);
    } finally {
      await daemon.close();
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "malformed daemon replies");
}
