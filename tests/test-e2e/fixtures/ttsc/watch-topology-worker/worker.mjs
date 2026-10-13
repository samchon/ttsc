/**
 * Exercise the packaged topology and dispatcher through real worker transport.
 * Supplied compiler/case operations isolate that transport from native hosts;
 * the control port delivers recorded filesystem notifications.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

const { options, shared, control, workspace } = workerData;
const owner = path.join(workspace, "packages/ttsc/lib/launcher/internal/watch");
const { WatchTopology } = await import(pathToFileURL(path.join(owner, "WatchTopology.js")));
const { serveWatchTopologyWorker } = await import(pathToFileURL(path.join(owner, "serveWatchTopologyWorker.js")));
const { watchDirectoryThroughFsWatch } = await import(pathToFileURL(path.join(owner, "watchDirectoryThroughFsWatch.js")));
const { deliverWatchEvent, recordWatchers } = await import(pathToFileURL(path.join(workspace, "tests/utils/src/RecordedWatchers.ts")));
const gate = new Int32Array(shared);
const recorder = recordWatchers(watchDirectoryThroughFsWatch);
const wait = (operation) => {
  if (Atomics.load(gate, 0) !== operation) return;
  Atomics.store(gate, 1, 1);
  Atomics.notify(gate, 1);
  Atomics.wait(gate, 0, operation);
};
const topology = new WatchTopology(options, {
  onError: (location, error) => parentPort.postMessage({ event: "error", location, error }),
  onInputChange: (change) => parentPort.postMessage({ event: "input", change }),
  onTopologyChange: () => parentPort.postMessage({ event: "topology" }),
}, recorder.openDirectoryWatch, recorder.openFileWatch, fs.readdirSync, () => {
  Atomics.add(gate, 2, 1);
  wait(1);
  if (Atomics.exchange(gate, 3, 0) === 1) throw new Error("owned listing failure");
  return [path.join(options.cwd, "src/main.ts")];
}, () => () => {
  wait(2);
  return undefined;
});
serveWatchTopologyWorker(topology, parentPort);
control.on("message", (command) => {
  deliverWatchEvent(recorder.watchers, command.path, command.event);
  control.postMessage("delivered");
});
// This test-owned port must not extend the production dispatcher's lifetime.
control.unref();
