import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RuntimeBuildCache } from "../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { ProcessOwnedDirectory } from "../../../../packages/ttsc/src/launcher/internal/runtime/ProcessOwnedDirectory";
import { systemRuntimeRunCanChange } from "../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";

export function requestRuntimeEmit(
  store: string,
  run: string,
  build: boolean,
  systemRoot?: string,
): string {
  const emitDir =
    systemRoot === undefined
      ? path.join(run, "emit")
      : path.join(run, "fs", "entry");
  let publication: RuntimeBuildCache.Publication | undefined;
  const output = path.join(emitDir, "main.js");
  fs.mkdirSync(emitDir, { recursive: true });
  const result = RuntimeBuildCache.run({
    directory: store,
    emitDir,
    ...(systemRoot === undefined
      ? { parkIn: run }
      : {
          runDir: run,
          canChange: (directory: string) =>
            systemRuntimeRunCanChange(directory, systemRoot, []),
          defer: (pending: RuntimeBuildCache.Publication) => {
            publication = pending;
          },
        }),
    capture: () => "fixed source snapshot",
    admit: (candidate) => candidate.status === 0,
    recordParked: (candidate) => candidate,
    build: () => {
      if (!build) throw new Error("unexpected dependency compile");
      fs.writeFileSync(output, "exports.value = 47;");
      return {
        status: 0,
        diagnostics: [],
        stdout: "",
        stderr: "",
        emittedSources: { [output]: [] },
      };
    },
  });
  if (result.status !== 0) throw new Error("dependency emit failed");
  const content = fs.readFileSync(output, "utf8");
  if (build) publication?.park();
  return content;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [stopAt, store, run, systemRoot] = process.argv.slice(2);
  if (systemRoot !== undefined) ProcessOwnedDirectory.claim(run!);
  const emitDir =
    systemRoot === undefined
      ? path.join(run!, "emit")
      : path.join(run!, "fs", "entry");
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    const taking = path
      .basename(path.dirname(String(from)))
      .endsWith(".pending");
    if (taking && stopAt === "before-take") stop();
    if (taking && stopAt === "lost-claim") {
      rename(from, path.join(path.dirname(run!), "winner"));
      stop(String(from));
    }
    rename(from, to);
    if (
      (taking && stopAt === "after-take") ||
      (to === emitDir && stopAt === "after-outputs")
    )
      stop();
  };
  requestRuntimeEmit(store!, run!, false, systemRoot);
  throw new Error("adoption completed without interruption");

  function stop(claimed?: string): never {
    fs.writeSync(2, claimed === undefined ? String(stopAt) : claimed);
    process.kill(process.pid, "SIGKILL");
    throw new Error("process survived SIGKILL");
  }
}
