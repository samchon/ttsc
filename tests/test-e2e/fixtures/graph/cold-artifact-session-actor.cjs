// Use the built public facade under the actor's explicit cache environment.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const { ColdGraphActorLifecycle } = await import(pathToFileURL(path.resolve(__dirname, "../../../utils/src/ColdGraphActorLifecycle.ts")).href);
  const { TtscGraphSession } = require(process.argv[2]);
  const { formatGraphFailure } = require(path.join(path.dirname(process.argv[2]), "server/formatGraphFailure.js"));
  const root = process.argv[3];
  const binary = process.argv[4];
  const report = process.argv[5];
  const session = new TtscGraphSession({ cwd: root, tsconfig: "tsconfig.json", binary });
  const controller = new AbortController();
  const reason = new Error("authored cold graph preparation cancellation");
  let operation;
  let queue = Promise.resolve();
  let failed = false;
  let stopping = false;
  const record = async (event, data = {}) => {
    fs.appendFileSync(report, JSON.stringify({ event, pid: process.pid, ...data }) + "\n");
    await ColdGraphActorLifecycle.send(process, { event, ...data });
  };
  // Report passive nested diagnostics over both already-owned channels. Neither
  // the message nor stderr certifies the original session's successful closure.
  const failure = async (event, error) => {
    const diagnostic = formatGraphFailure(error);
    process.stderr.write(diagnostic + "\n");
    await record(event, { diagnostic });
  };
  const terminalError = (error) => {
    process.stderr.write(formatGraphFailure(error) + "\n");
    process.exitCode = 1;
  };
  const close = ColdGraphActorLifecycle.terminal({
    close: () => session.close(),
    drain: async () => {
      await queue;
      if (operation) await operation.catch(() => undefined);
    },
    verify: async () => {
      await assert.rejects(session.graph(), /closed/);
      await session.close();
    },
    publish: async (failures) => {
      if (failures.length)
        await failure("close-failed", new AggregateError(failures, "Original Session close was not confirmed"));
      else await record(failed ? "closed-after-failure" : "closed");
    },
    disconnect: () => {
      process.removeListener("message", message);
      if (process.connected) process.disconnect();
    },
  });
  const requestClose = () => {
    if (stopping) return;
    stopping = true;
    controller.abort(reason);
    void close().catch(terminalError);
  };
  const message = (message) => {
    if (message === "abort") { controller.abort(reason); return; }
    if (message === "close") {
      requestClose();
      return;
    }
    if (stopping) return;
    queue = queue.then(async () => {
      if (message === "start") {
        operation = session.graph({ signal: controller.signal });
        void operation.catch(() => undefined);
        await record("started");
      } else if (message === "recover") {
        await assert.rejects(operation, (error) => error.name === "AbortError" && error.message.includes(reason.message));
        assert.equal(controller.signal.reason, reason);
        await record("cancelled");
        const graph = await session.graph();
        assert.ok(graph.nodes.some((node) => node.id === "docs/contract.md#accepted-value"), "actual configured publisher artifact missing after recovery");
        const repeated = await session.graph();
        assert.equal(repeated, graph, "unchanged warm graph did not reuse its model");
        await record("recovered", { nodes: graph.nodes.length });
      }
    }).catch(async (error) => {
      failed = true;
      process.exitCode = 1;
      try { await failure("failed", error); }
      catch (publication) { terminalError(new AggregateError([error, publication], "Actor operation and failure publication failed")); }
      finally { requestClose(); }
    });
  };
  process.on("message", message);
  process.once("disconnect", requestClose);
  try { await record("ready"); }
  catch (error) {
    failed = true;
    terminalError(error);
    requestClose();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  if (process.connected) process.disconnect();
});
