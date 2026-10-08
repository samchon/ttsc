import { observed } from "./native-factory";
import { value } from "./declared-owned.cjs";
declare const console: { log(value: unknown): void };
declare function require(id: string): { value: string };
const placementProcess = (globalThis as any).process;
const placement = require(placementProcess.env.TTSC_E2E_CONFIGLESS_PLACEMENT ?? "../../tools/runtime-placement.ts");
if (placement.value !== "lowered") throw new Error("default orphan placement lost the typed value");
console.log(value);
console.log("TTSC_DECLARED_REGISTER:" + JSON.stringify(observed));
const nativeProcess = (globalThis as any).process;
const nativeFs = require("node:fs") as any;
const nativePath = require("node:path") as any;
const nativeChildProcess = require("node:child_process") as any;
const descendant = nativePath.join(nativeProcess.cwd(), "tools/runtime-descendant");
const child = nativeChildProcess.spawn(nativeProcess.execPath, [nativePath.join(descendant, "worker.cjs")], {
  detached: true, stdio: "ignore", windowsHide: true,
});
child.unref();
nativeFs.writeFileSync(nativePath.join(descendant, "parent.json"), JSON.stringify({ parent: nativeProcess.pid, child: child.pid }));
const readyDeadline = Date.now() + 30000;
while (!nativeFs.existsSync(nativePath.join(descendant, "ready.json"))) {
  if (Date.now() > readyDeadline) throw new Error("registered descendant did not become ready");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}
// This parent is actually loaded through register; no synthetic parent skips
// its normal preparation gate. Native ESM loading remains asynchronous.
void (require("./package-boundary.cjs") as any).observePackageBoundary().then(
  (value: unknown) => console.log("TTSC_INSTALLED_BOUNDARY_REGISTER:" + JSON.stringify(value)),
  (error: unknown) => { console.log(String(error)); nativeProcess.exitCode = 1; },
);
