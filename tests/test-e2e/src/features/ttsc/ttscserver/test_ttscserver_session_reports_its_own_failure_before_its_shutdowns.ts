import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  TtscserverClient,
  initializeTtscserverClient,
  runTtscserverSession,
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
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its server and root; existing shutdown, EOF or terminate paths end its child, and the shared client drains stderr and rejects pending requests on close. Mutable launcher environment is passed only to the owned child.
 * @evidence contracts/e2e.md#preserved-coverage runTtscserverSession reports the work error first and the failed shutdown alongside it after abrupt host termination. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_session_reports_its_own_failure_before_its_shutdowns =
  async () => {
    const cwd = TestProject.tmpdir("ttscserver-session-failure-");
    const client = TtscserverClient.startLauncher(cwd);
    const own = new Error("the session's own work failed");
    const thrown = await runTtscserverSession(client, async () => {
      await initializeTtscserverClient(client, cwd);
      client.terminate();
      await client.waitForExit();
      throw own;
    }).then(
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
