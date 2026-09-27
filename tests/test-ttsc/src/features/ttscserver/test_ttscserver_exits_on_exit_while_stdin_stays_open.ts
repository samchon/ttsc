import * as os from "node:os";

import { TtscserverClient, assert } from "../../internal/ttscserver";

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
 */
export const test_ttscserver_exits_on_exit_while_stdin_stays_open =
  async () => {
    const client = TtscserverClient.start(os.tmpdir());
    await client.request("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    });
    client.notify("initialized", {});
    await client.request("shutdown");
    client.notify("exit");

    let timer: NodeJS.Timeout | undefined;
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
  };
