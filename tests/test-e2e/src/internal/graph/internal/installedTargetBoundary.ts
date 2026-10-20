import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { CompilerTarget } from "../../../../../../packages/ttsc/lib/plugin/internal/source/CompilerTarget.js";
import { FixtureFiles } from "../../FixtureFiles";
import { resolveGraphLauncher, resolveTtscgraphBinary } from "./ttsgraph";

const require_ = createRequire(import.meta.url);

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
  // project; it does not conflict with the installation-resolution witness.
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
  // Two installations of the built @ttsc/graph: one beside its platform
  // package holding a real native copy, one without that package. Neither the
  // target projects nor the launcher's working directory hold a producer, so
  // only the installation can supply one.
  const installation = TestProject.tmpdir("ttscgraph-installation-");
  const missingInstallation = TestProject.tmpdir(
    "ttscgraph-uninstalled-graph-",
  );
  const installed = installGraph(installation);
  const missing = installGraph(missingInstallation);
  const platform = `${process.platform}-${process.arch}`;
  const platformDir = path.join(
    installation,
    "node_modules",
    "@ttsc",
    `graph-${platform}`,
  );
  // The installed client runs the producer of the target project's TypeScript
  // line, which is the workspace's own: ttscgraph for 7.0, ttscgraph-7.1 for
  // 7.1. The installation carries that producer, so the dump and permission
  // receipt below observe the binary the client actually launches.
  const producer =
    CompilerTarget.lineOf(
      (
        require_(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "node_modules",
            "typescript",
            "package.json",
          ),
        ) as { version: string }
      ).version,
    ).line === "7.0"
      ? "ttscgraph"
      : "ttscgraph-7.1";
  const executable =
    process.platform === "win32" ? `${producer}.exe` : producer;
  const binary = path.join(platformDir, "bin", executable);
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  const override = process.env.TTSC_GRAPH_BINARY;
  fs.copyFileSync(
    override && path.isAbsolute(override)
      ? override
      : path.join(path.dirname(resolveTtscgraphBinary()), executable),
    binary,
  );
  fs.writeFileSync(
    path.join(platformDir, "package.json"),
    JSON.stringify({ name: `@ttsc/graph-${platform}`, version: "0.0.0" }),
  );
  if (process.platform !== "win32") fs.chmodSync(binary, 0o644);
  const beforeMode = fs.statSync(binary).mode;
  const retainAll = (reason: string): void => {
    if (coordinates === undefined)
      TestProject.retainTemporaryDirectory(root, reason);
    else coordinates.retain(reason);
    TestProject.retainTemporaryDirectory(empty, reason);
    TestProject.retainTemporaryDirectory(installation, reason);
    TestProject.retainTemporaryDirectory(missingInstallation, reason);
  };
  const dump = launch(["dump", "--cwd", root], {
    cwd: elsewhere,
    graphBinary: "",
    launcher: installed.launcher,
    retainUnjoined: retainAll,
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
    retainAll(reason);
  };
  return {
    root,
    empty,
    elsewhere,
    binary,
    installed,
    missing,
    beforeMode,
    afterMode,
    dump,
    retainUnjoined,
    preventReuse,
  };
}

/**
 * Lay out an installed `@ttsc/graph` under `directory`: a copy of the built
 * package and links to the dependencies it loads. The copy is a real directory,
 * so Node module resolution for its platform package starts from the
 * installation rather than from the checkout.
 */
function installGraph(directory: string): {
  launcher: string;
  loadGraph(options: { cwd: string; tsconfig: string }): unknown;
} {
  const source = path.dirname(require_.resolve("@ttsc/graph/package.json"));
  const target = path.join(directory, "node_modules", "@ttsc", "graph");
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(
    path.join(source, "package.json"),
    path.join(target, "package.json"),
  );
  TestProject.copyDirectory(path.join(source, "lib"), path.join(target, "lib"));
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  })) {
    const link = path.join(directory, "node_modules", ...name.split("/"));
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(
      fs.realpathSync.native(path.join(source, "node_modules", name)),
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  const entry = path.join(target, "lib", "index.js");
  return {
    launcher: path.join(target, "lib", "bin.js"),
    loadGraph: (options) =>
      (
        require_(entry) as {
          loadGraph(options: { cwd: string; tsconfig: string }): unknown;
        }
      ).loadGraph(options),
  };
}

/** Drive an installed facade with explicit cwd and override ownership. */
export function launch(
  args: string[],
  options: {
    cwd: string;
    graphBinary: string;
    launcher?: string;
    retainUnjoined?(reason: string): void;
  },
) {
  if (unavailable !== undefined) throw unavailable;
  const result = TestProject.spawn(
    process.execPath,
    [
      options.launcher ??
        prepared?.installed.launcher ??
        resolveGraphLauncher(),
      ...args,
    ],
    {
      cwd: options.cwd,
      env: { TTSC_GRAPH_BINARY: options.graphBinary },
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
