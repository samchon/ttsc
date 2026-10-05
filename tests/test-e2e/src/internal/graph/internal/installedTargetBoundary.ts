import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../FixtureFiles";
import { resolveGraphLauncher, resolveTtscgraphBinary } from "./ttsgraph";

let prepared: ReturnType<typeof prepare> | undefined;
let unavailable: Error | undefined;

/** Share the real installed binary's cold first dump and permission receipt. */
export function installedTargetBoundary(coordinates?: {
  root: string;
  empty: string;
  elsewhere: string;
  retain(reason: string): void;
}): ReturnType<typeof prepare> {
  if (unavailable !== undefined) throw unavailable;
  return (prepared ??= prepare(coordinates));
}

function prepare(coordinates?: {
  root: string;
  empty: string;
  elsewhere: string;
  retain(reason: string): void;
}) {
  const root =
    coordinates?.root ??
    TestProject.createProject(
      FixtureFiles.read("graph/installedTargetBoundary/inputs-1"),
    );
  // Keep the resident lifetime's original authored declaration in this same
  // installed project; it does not conflict with the target-resolution witness.
  fs.writeFileSync(
    path.join(root, "src", "resident.ts"),
    FixtureFiles.read(
      "graph/ttscgraph_resident_adapter_owns_real_native_lifetime/inputs-1",
    )["src/app.ts"]!,
  );
  const empty =
    coordinates?.empty ??
    TestProject.createProject(
      FixtureFiles.read("graph/installedTargetBoundary/inputs-2"),
    );
  const elsewhere =
    coordinates?.elsewhere ??
    TestProject.tmpdir("ttscgraph-uninstalled-launcher-");
  const platform = `${process.platform}-${process.arch}`;
  const platformDir = path.join(root, "node_modules", "@ttsc", platform);
  const binary = path.join(
    platformDir,
    "bin",
    process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph",
  );
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.copyFileSync(resolveTtscgraphBinary(), binary);
  fs.writeFileSync(
    path.join(platformDir, "package.json"),
    JSON.stringify({ name: `@ttsc/${platform}`, version: "0.0.0" }),
  );
  const ttscDir = path.join(root, "node_modules", "ttsc");
  fs.mkdirSync(ttscDir, { recursive: true });
  fs.writeFileSync(
    path.join(ttscDir, "package.json"),
    '{"name":"ttsc","version":"0.0.0"}',
  );
  if (process.platform !== "win32") fs.chmodSync(binary, 0o644);
  const beforeMode = fs.statSync(binary).mode;
  const dump = launch(["dump", "--cwd", root], {
    cwd: elsewhere,
    graphBinary: "",
    retainUnjoined: (reason) => {
      if (coordinates === undefined)
        TestProject.retainTemporaryDirectory(root, reason);
      else coordinates.retain(reason);
      TestProject.retainTemporaryDirectory(empty, reason);
    },
  });
  const afterMode = fs.statSync(binary).mode;
  // A failed process join withdraws reuse and exit-cleanup authority. Later
  // consumers must not mutate inputs an unresolved owned process may still read.
  const preventReuse = (reason: string): void => {
    unavailable = new Error(
      `Shared installed graph project is unavailable: ${reason}`,
    );
  };
  const retainUnjoined = (reason: string): void => {
    preventReuse(reason);
    if (coordinates === undefined)
      TestProject.retainTemporaryDirectory(root, reason);
    else {
      coordinates.retain(reason);
      TestProject.retainTemporaryDirectory(empty, reason);
    }
  };
  return {
    root,
    empty,
    elsewhere,
    binary,
    beforeMode,
    afterMode,
    dump,
    retainUnjoined,
    preventReuse,
  };
}

/** Drive an installed facade with explicit cwd and override ownership. */
export function launch(
  args: string[],
  options: {
    cwd: string;
    graphBinary: string;
    retainUnjoined?(reason: string): void;
  },
) {
  if (unavailable !== undefined) throw unavailable;
  const result = TestProject.spawn(
    process.execPath,
    [resolveGraphLauncher(), ...args],
    {
      cwd: options.cwd,
      env: { TTSC_GRAPH_BINARY: options.graphBinary },
      timeout: 60_000,
    },
  );
  if (result.error || result.signal !== null || result.status === null) {
    (options.retainUnjoined ?? prepared?.retainUnjoined)?.(
      "target graph facade closure remained unresolved",
    );
    throw new Error("target graph facade closure remained unresolved", {
      cause: result.error,
    });
  }
  return result;
}
