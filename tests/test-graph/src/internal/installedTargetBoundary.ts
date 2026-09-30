import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { resolveGraphLauncher, resolveTtscgraphBinary } from "./ttsgraph";

let prepared: ReturnType<typeof prepare> | undefined;

/** Share the real installed binary's cold first dump and permission receipt. */
export function installedTargetBoundary(): ReturnType<typeof prepare> {
  return prepared ??= prepare();
}

function prepare() {
  const root = TestProject.createProject({
    "package.json": '{"name":"installed-native-target"}',
    "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs" }, include: ["src"] }),
    "src/app.ts": "export function NativeTargetControl(): void {}\n",
    "invalid.json": "{not-json",
    "project.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs" }, include: ["src"] }),
  });
  const empty = TestProject.createProject({
    "package.json": '{"name":"native-override-target"}',
    "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs" }, include: ["src"] }),
    "src/app.ts": "export function NativeOverrideControl(): void {}\n",
  });
  const elsewhere = TestProject.tmpdir("ttscgraph-uninstalled-launcher-");
  const platform = `${process.platform}-${process.arch}`;
  const platformDir = path.join(root, "node_modules", "@ttsc", platform);
  const binary = path.join(platformDir, "bin", process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph");
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.copyFileSync(resolveTtscgraphBinary(), binary);
  fs.writeFileSync(path.join(platformDir, "package.json"), JSON.stringify({ name: `@ttsc/${platform}`, version: "0.0.0" }));
  const ttscDir = path.join(root, "node_modules", "ttsc");
  fs.mkdirSync(ttscDir, { recursive: true });
  fs.writeFileSync(path.join(ttscDir, "package.json"), '{"name":"ttsc","version":"0.0.0"}');
  if (process.platform !== "win32") fs.chmodSync(binary, 0o644);
  const beforeMode = fs.statSync(binary).mode;
  const dump = launch(["dump", "--cwd", root], { cwd: elsewhere, graphBinary: "" });
  const afterMode = fs.statSync(binary).mode;
  return { root, empty, elsewhere, binary, beforeMode, afterMode, dump };
}

/** Drive an installed facade with explicit cwd and override ownership. */
export function launch(args: string[], options: { cwd: string; graphBinary: string }) {
  return TestProject.spawn(process.execPath, [resolveGraphLauncher(), ...args], {
    cwd: options.cwd,
    env: { TTSC_GRAPH_BINARY: options.graphBinary },
    timeout: 60_000,
  });
}
