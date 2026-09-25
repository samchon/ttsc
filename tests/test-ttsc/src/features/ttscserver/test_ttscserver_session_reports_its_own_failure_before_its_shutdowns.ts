import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  TtscserverClient,
  initializeTtscserverClient,
  runTtscserverSession,
} from "../../internal/ttscserver";

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
