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
let ready: unknown;
child.once("error", (error: unknown) => { (globalThis as any).clearInterval(ready); throw error; });
child.once("close", () => {
  if (!nativeFs.existsSync(nativePath.join(descendant, "ready.json"))) {
    (globalThis as any).clearInterval(ready);
    nativeProcess.exitCode = 1;
  }
});
// The child publishes ready only after the outer controller acquired both
// original targets. The real register parent then performs its independent
// native preparation; no descendant release deadline runs during that work.
ready = (globalThis as any).setInterval(() => {
  if (!nativeFs.existsSync(nativePath.join(descendant, "ready.json"))) return;
  (globalThis as any).clearInterval(ready);
  void (require("./package-boundary.cjs") as any).observePackageBoundary().then(
    (value: unknown) => console.log("TTSC_INSTALLED_BOUNDARY_REGISTER:" + JSON.stringify(value)),
    (error: unknown) => { console.log(String(error)); nativeProcess.exitCode = 1; },
  );
}, 10);
