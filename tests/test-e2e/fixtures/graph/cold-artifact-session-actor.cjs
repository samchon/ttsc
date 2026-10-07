// Use the built public facade under the actor's explicit cache environment.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { TtscGraphSession } = require(process.argv[2]);
const root = process.argv[3];
const binary = process.argv[4];
const report = process.argv[5];
const session = new TtscGraphSession({ cwd: root, tsconfig: "tsconfig.json", binary });
const controller = new AbortController();
const reason = new Error("authored cold graph preparation cancellation");
let operation;
let queue = Promise.resolve();
let closing;
const record = (event, data = {}) => {
  fs.appendFileSync(report, JSON.stringify({ event, pid: process.pid, ...data }) + "\n");
  process.send?.({ event, ...data });
};
process.on("message", (message) => {
  if (message === "abort") { controller.abort(reason); return; }
  if (message === "close") {
    controller.abort(reason);
    closing ??= (async () => {
      await session.close();
      await queue;
      if (operation) await operation.catch(() => undefined);
      await assert.rejects(session.graph(), /closed/);
      await session.close();
      record("closed");
    })().catch((error) => {
      record("close-failed", { message: String(error) });
      process.exitCode = 1;
    }).finally(() => { if (process.connected) process.disconnect(); });
    return;
  }
  queue = queue.then(async () => {
    if (message === "start") {
      operation = session.graph({ signal: controller.signal });
      void operation.catch(() => undefined);
      record("started");
    } else if (message === "recover") {
      await assert.rejects(operation, (error) => error.name === "AbortError" && error.message.includes(reason.message));
      assert.equal(controller.signal.reason, reason);
      record("cancelled");
      const graph = await session.graph();
      assert.ok(graph.nodes.some((node) => node.id === "docs/contract.md#accepted-value"), "actual configured publisher artifact missing after recovery");
      const repeated = await session.graph();
      assert.equal(repeated, graph, "unchanged warm graph did not reuse its model");
      record("recovered", { nodes: graph.nodes.length });
    }
  }).catch(async (error) => {
    record("failed", { message: String(error), stack: error.stack });
    controller.abort(reason);
    try { await session.close(); record("closed-after-failure"); }
    catch (cleanup) { record("close-failed", { message: String(cleanup) }); }
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
});
record("ready");
