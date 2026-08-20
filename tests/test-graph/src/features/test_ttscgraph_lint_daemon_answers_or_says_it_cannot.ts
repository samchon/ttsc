import assert from "node:assert/strict";

import {
  createLintDaemonFixture,
  readSidecarArguments,
  readSidecarRequests,
} from "../internal/lintDaemon";

/**
 * Verifies the resident sidecar client answers from the sidecar it opened, and
 * says it cannot rather than answering nothing when it cannot.
 *
 * Every other case about the artifact channel would pass with this client
 * removed. A daemon that never answers falls back to one process per verb, and
 * the fallback returns the same bytes, so the only visible difference is cost.
 * That is the same shape as the defect this whole cycle came from: the channel
 * shipped publishing nothing for a full release because an empty answer is
 * indistinguishable from the correct answer for most projects. So this case
 * reads what the sidecar was spawned with and what it received, rather than
 * inferring either from a result that looks alike either way.
 *
 * The `null` direction matters as much as the answering one. `null` from this
 * client has to mean "ask the sidecar directly", never "the project has none":
 * a client that returned an empty answer for a daemon that could not serve
 * would put the original defect back, one layer down.
 *
 * 1. Ask two verbs of a sidecar that serves, and require the sidecar's own answers
 *    back, one spawn, and the invalidate control on the wire.
 * 2. Ask a sidecar that rejects a verb, and require `null` and no second spawn.
 * 3. Ask a sidecar built before `lsp-serve`, and require `null` rather than a
 *    throw.
 * 4. Ask two verbs at once and require each its own answer, in order.
 */
export const test_ttscgraph_lint_daemon_answers_or_says_it_cannot =
  async (): Promise<void> => {
    await verifyServes();
    await verifyRejectedVerbFallsBack();
    await verifyMissingServeFallsBack();
    await verifyConcurrentAsksAreSerialized();
  };

/** A sidecar that serves: its answers, its spawn, and its request stream. */
async function verifyServes(): Promise<void> {
  const fixture = createLintDaemonFixture({
    mode: "serve",
    projectContext: '{"physicalProjectRoot":"/fixture"}',
  });
  try {
    const inputs = await fixture.daemon.ask("project-inputs", true);
    const nodes = await fixture.daemon.ask("graph-nodes", false);

    assert.notEqual(
      inputs,
      null,
      "the daemon could not answer a verb its sidecar serves, so every republish would silently pay a process per verb",
    );
    assert.equal(
      (JSON.parse(inputs!) as { servedBy?: string; verb?: string }).servedBy,
      "daemon",
      `the answer did not come from the open sidecar: ${String(inputs)}`,
    );
    assert.equal(
      (JSON.parse(nodes!) as { verb?: string }).verb,
      "graph-nodes",
      `the second verb was answered with the first one's reply: ${String(nodes)}`,
    );

    const spawns = readSidecarArguments(fixture.root);
    assert.equal(
      spawns.length,
      1,
      `two verbs cost ${String(spawns.length)} spawns; the sidecar is not being held open at all`,
    );
    assert.equal(
      spawns[0]![0],
      "lsp-serve",
      `the sidecar was not opened as a daemon: ${spawns[0]!.join(" ")}`,
    );
    // Without the project flag a rule resolves no root and answers with an
    // empty set, which is the defect this cycle was about. The daemon carries
    // it on its own argv, where a one-shot carries it per invocation.
    for (const flag of [
      "--cwd=",
      "--tsconfig=",
      "--plugins-json=",
      "--project-context-json=",
    ])
      assert.equal(
        spawns[0]!.some((argument) => argument.startsWith(flag)),
        true,
        `the daemon was opened without ${flag}: ${spawns[0]!.join(" ")}`,
      );

    const requests = readSidecarRequests(fixture.root);
    assert.deepEqual(
      requests.map((request) => [request.verb, request.invalidate]),
      [
        ["project-inputs", true],
        ["graph-nodes", false],
      ],
      "the request stream is not what the client says it puts on the wire",
    );
  } finally {
    fixture.daemon.close();
  }
}

/** A verb the sidecar rejects: `null`, and no retry through the daemon. */
async function verifyRejectedVerbFallsBack(): Promise<void> {
  const fixture = createLintDaemonFixture({
    mode: "serve",
    rejectVerb: "graph-nodes",
  });
  try {
    assert.notEqual(
      await fixture.daemon.ask("project-inputs", true),
      null,
      "a served verb was refused, so the rejection below would prove nothing",
    );
    assert.equal(
      await fixture.daemon.ask("graph-nodes", false),
      null,
      "a rejected verb was answered; the caller would read the sidecar's refusal as a project that publishes nothing",
    );
    // Closing rather than retrying is what sends the caller to the direct
    // command, where a real rule failure surfaces the way it always did.
    assert.equal(
      await fixture.daemon.ask("project-inputs", true),
      null,
      "the daemon kept serving after refusing a verb; this client cannot tell an unknown verb from a failed rule, so it must stop asking",
    );
    assert.equal(
      readSidecarArguments(fixture.root).length,
      1,
      "the daemon respawned its sidecar after closing it",
    );
  } finally {
    fixture.daemon.close();
  }
}

/** A sidecar that predates `lsp-serve`: `null`, not an exception. */
async function verifyMissingServeFallsBack(): Promise<void> {
  const fixture = createLintDaemonFixture({ mode: "no-serve" });
  try {
    assert.equal(
      await fixture.daemon.ask("project-inputs", true),
      null,
      "a sidecar that does not know lsp-serve produced something other than null",
    );
    assert.equal(
      await fixture.daemon.ask("graph-nodes", false),
      null,
      "the second verb did not also decline",
    );
  } finally {
    fixture.daemon.close();
  }
}

/**
 * Two asks in flight at once.
 *
 * The reply carries nothing to address it by, so the client has to serialize: a
 * second request on the wire before the first is answered would be matched
 * against the first one's reply, and both callers would read the wrong verb's
 * result as their own.
 */
async function verifyConcurrentAsksAreSerialized(): Promise<void> {
  const fixture = createLintDaemonFixture({ mode: "serve" });
  try {
    const [first, second] = await Promise.all([
      fixture.daemon.ask("project-inputs", true),
      fixture.daemon.ask("graph-nodes", false),
    ]);
    assert.equal(
      (JSON.parse(first!) as { verb?: string }).verb,
      "project-inputs",
      "a concurrent ask was answered with the other request's reply",
    );
    assert.equal(
      (JSON.parse(second!) as { verb?: string }).verb,
      "graph-nodes",
      "a concurrent ask was answered with the other request's reply",
    );
    assert.deepEqual(
      readSidecarRequests(fixture.root).map((request) => request.verb),
      ["project-inputs", "graph-nodes"],
      "the two requests did not reach the sidecar one at a time",
    );
  } finally {
    fixture.daemon.close();
  }
}
