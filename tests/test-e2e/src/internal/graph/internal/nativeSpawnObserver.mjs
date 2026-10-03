import { channel } from "node:diagnostics_channel";
import fs from "node:fs";

// Node's supported process diagnostics and spawn event observe successful
// creation without replacing foreign functions or manufacturing native replies.
// Only the exact producer passed to the shared MCP launcher contributes a receipt.
const binary = process.env.TTSC_GRAPH_BINARY;
const receipt = process.env.TTSC_E2E_GRAPH_SPAWN_RECEIPT;
const processes = channel("child_process");
const pending = new Map();
let nextId = 0;
function observe({ process: child }) {
  const spawned = () => {
    release();
    if (receipt && child.spawnfile === binary) {
      const id = ++nextId;
      fs.appendFileSync(
        receipt,
        `${JSON.stringify({ id, binary, pid: child.pid, event: "spawned" })}\n`,
      );
      const closed = (code, signal) => {
        pending.delete(child);
        fs.appendFileSync(
          receipt,
          `${JSON.stringify({ id, binary, pid: child.pid, event: "closed", code, signal })}\n`,
        );
      };
      pending.set(child, () => child.off("close", closed));
      child.once("close", closed);
    }
  };
  const release = () => {
    child.off("spawn", spawned);
    child.off("error", release);
    pending.delete(child);
  };
  pending.set(child, release);
  child.once("spawn", spawned);
  child.once("error", release);
}
processes.subscribe(observe);
process.once("exit", () => {
  processes.unsubscribe(observe);
  for (const release of pending.values()) release();
  pending.clear();
});
