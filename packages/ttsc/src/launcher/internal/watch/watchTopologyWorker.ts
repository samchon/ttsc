/**
 * Run the synchronous topology on its owned thread. Keeping native probes,
 * listings and digests together preserves transaction and baseline semantics
 * while the launcher's resident process timers remain free to run (#1758).
 */
import { parentPort, workerData } from "node:worker_threads";

import { serializeCompilerError } from "../../../internal/serializeCompilerError";
import { WatchTopology } from "./WatchTopology";
import type { WatchTopologyWorkerProtocol } from "./WatchTopologyWorkerProtocol";
import { serveWatchTopologyWorker } from "./serveWatchTopologyWorker";

const port = parentPort!;
const send = (reply: WatchTopologyWorkerProtocol.Reply): void =>
  port.postMessage(reply);
const topology = new WatchTopology(
  workerData as WatchTopologyWorkerProtocol.Options,
  {
    onError: (location, error) =>
      send({ event: "error", location, error: serializeCompilerError(error) }),
    onInputChange: (change) => send({ event: "input", change }),
    onProjectInputWatchRoots: (roots) => send({ event: "roots", roots }),
    onProjectInputWatchUnavailable: (roots) =>
      send({ event: "unavailable", roots }),
    onTopologyChange: () => send({ event: "topology" }),
  },
);

serveWatchTopologyWorker(topology, port);
