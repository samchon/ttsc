import * as os from "node:os";

import { TtscserverClient, assert } from "../../../internal/ttsc/internal/ttscserver";

/**
 * Verifies ttscserver ends its process on the LSP `exit` notification while the
 * editor keeps its stdin open.
 *
 * The specification has `exit` ask the server to exit its process, and plain
 * `tsc --lsp --stdio` does. ttscserver waited for the editor to close stdin as
 * well, and a read blocked on a Windows pipe is not interrupted by closing it,
 * so after `exit` the process kept running until the editor closed the pipe or
 * killed it (samchon/ttsc#1575). `test_ttscserver_initializes_and_shuts_down`
 * closes stdin after `exit`, so it could not see this.
 *
 * 1. Spawn ttscserver and complete `initialize`.
 * 2. Send `shutdown` and `exit`, and leave stdin open.
 * 3. Assert the process exits with status 0 within ten seconds.
 *
 * @evidence contracts/testing.md#behavioral-verification A real initialized ttscserver exits zero within ten seconds after shutdown/exit while editor stdin stays open.
 * @evidence contracts/testing.md#independent-expectations The LSP exit notification terminates the server process independently of pipe closure; leaving the pipe open distinguishes the former deadlock.
 * @evidence contracts/testing.md#distinguishing-cases 1. Spawn ttscserver and complete `initialize`. 2. Send `shutdown` and `exit`, and leave stdin open. 3. Assert the process exits with status 0 within ten seconds.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual launcher or native ttscserver process connects stdio, startup environment and process shutdown; direct request-planning operations cannot establish this named lifecycle or forwarding outcome.
 * @evidence contracts/e2e.md#shared-execution The case uses one server lifetime and reuses the existing built compiler/server. EOF, abrupt termination and exit-with-open-stdin require distinct process lifetimes because each destroys the connection it observes; no new consumer installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its server and root; normal shutdown ends its child, and assertion or request failure terminates and awaits the child before rethrowing the original error, and the shared client drains stderr and rejects pending requests on close. Mutable launcher environment is passed only to the owned child.
 * @evidence contracts/e2e.md#preserved-coverage A real initialized ttscserver exits zero within ten seconds after shutdown/exit while editor stdin stays open. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_exits_on_exit_while_stdin_stays_open =
  async () => {
    const client = TtscserverClient.start(os.tmpdir());
    let timer: NodeJS.Timeout | undefined;
    try {
    await client.request("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    });
    client.notify("initialized", {});
    await client.request("shutdown");
    client.notify("exit");

    const code = await Promise.race([
      client.waitForExit(),
      new Promise<"running">((resolve) => {
        timer = setTimeout(() => resolve("running"), 10_000);
      }),
    ]);
    clearTimeout(timer);
    if (code === "running") client.endStdin();
    assert.equal(
      code,
      0,
      `ttscserver must exit on the exit notification with stdin still open (stderr=${client.stderrText()})`,
    );
    } catch (error) {
      clearTimeout(timer);
      client.terminate();
      await client.waitForExit();
      throw error;
    }
  };
