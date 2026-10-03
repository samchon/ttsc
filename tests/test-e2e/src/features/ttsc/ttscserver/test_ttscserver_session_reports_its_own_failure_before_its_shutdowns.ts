import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  TtscserverClient,
  initializeTtscserverClient,
  runTtscserverSession,
  waitForTtscserverOutcome,
} from "../../../internal/ttsc/internal/ttscserver";

/**
 * Verifies a `ttscserver` test session reports the failure of its own work, not
 * the shutdown that followed it.
 *
 * Server tests shut their session down from a `finally` block, and the shutdown
 * asserts a clean exit. When the work failed while the server could not exit
 * cleanly (a wait that timed out during a cold plugin build, for one), the
 * shutdown's assertion replaced the work's error, and the report pointed at
 * shutdown instead of the wait (samchon/ttsc#1513). `runTtscserverSession`
 * throws the work's error first, with the shutdown's beside it.
 *
 * 1. Start a session on an empty root and initialize it.
 * 2. Inside the session's work, end the server abruptly, so its shutdown can no
 *    longer succeed, then fail the work with its own error.
 * 3. Assert the thrown error leads with the work's error and carries the
 *    shutdown's failure after it.
 *
 * @evidence contracts/testing.md#behavioral-verification runTtscserverSession reports the work error first and the failed shutdown alongside it after abrupt host termination.
 * @evidence contracts/testing.md#independent-expectations A deliberately thrown work sentinel and actual terminated child produce independently distinct errors whose order must preserve the primary cause.
 * @evidence contracts/testing.md#distinguishing-cases 1. Start a session on an empty root and initialize it. 2. Inside the session's work, end the server abruptly, so its shutdown can no longer succeed, then fail the work with its own error. 3. Assert the thrown error leads with the work's error and carries the shutdown's failure after it.
 * @evidence contracts/testing.md#execution-ownership test-e2e selects this matching src/features/ttsc/ttscserver entry. The built JavaScript launcher starts the selected server, and the session helper's ordered errors are observed after deliberate termination; no packed installation or cold plugin build is performed.
 * @evidence contracts/e2e.md#necessary-boundary A real initialized launcher/server connection is terminated before shutdown is requested. Its direct close and resulting shutdown error distinguish this connection from a supplied error-only session policy unit.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before startup. After initialization, terminate requests child termination and a separate bounded wait observes direct close; kill alone is not a join. Shutdown has a separate deadline, which does not cancel its losing operation. An unresolved close retains inputs and is not arbitrary descendant termination proof.
 * @evidence contracts/e2e.md#preserved-coverage runTtscserverSession reports the work error first and the failed shutdown alongside it after abrupt host termination. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_session_reports_its_own_failure_before_its_shutdowns =
  async () => {
    const cwd = TestProject.tmpdir("ttscserver-session-failure-");
    TestProject.retainTemporaryDirectory(cwd);
    const client = TtscserverClient.startLauncher(cwd);
    const own = new Error("the session's own work failed");
    const thrown = await runTtscserverSession(
      client,
      async () => {
        await initializeTtscserverClient(client, cwd);
        client.terminate();
        await waitForTtscserverOutcome(
          client.waitForExit(),
          30_000,
          "terminated server did not close",
        );
        throw own;
      },
      30_000,
    ).then(
      () => undefined,
      (error: unknown) => error,
    );

    assert.ok(
      thrown instanceof AggregateError,
      `the work's error and the shutdown's travel together: ${String(thrown)}`,
    );
    assert.equal(thrown.errors[0], own, "the work's error comes first");
    assert.ok(thrown.message.startsWith(own.message));
    assert.match(String(thrown.errors[1]), /ttscserver should exit cleanly/);
  };
