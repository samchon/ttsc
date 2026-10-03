import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The parent owns preparation, nonce admission, lifetime and cleanup. This
// process performs the original 150 actual record/progress/compaction rounds.
const [root, scratch, moduleFile, nonce] = process.argv.slice(2);
const fingerprint = await import(pathToFileURL(moduleFile).href);
const project = fingerprint.resolveProjectView({ projectRoot: root });
fs.writeFileSync(path.join(scratch, "ready.txt"), nonce, { flag: "wx" });
for (let round = 0; round < 150; ++round) {
  fingerprint.createSnapshotRecorder().record({
    input: path.resolve(scratch, "input-" + round + ".d.ts"),
    project,
  });
  fs.writeFileSync(path.join(scratch, "progress.txt"), String(round + 1));
  fingerprint.prepareSnapshot(root);
}
fs.writeFileSync(path.join(scratch, "progress.txt"), "done");
fs.writeFileSync(path.join(scratch, "done.txt"), nonce, { flag: "wx" });
