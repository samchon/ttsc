// Playground compiler worker.
//
// Runs inside a Web Worker bundled by rspack (see `rspack.config.js` and
// `build/compiler.cjs`). The worker boots the `playground.wasm` binary the
// website ships under `public/compiler/`, which is a `@ttsc/wasm`-style
// consumer wasm produced from `website/compiler/cmd/playground/main_wasm.go`
// with the banner / paths / strip / lint / typia plugins linked in.
//
// All meaningful logic lives in `@ttsc/playground`; this file just wires the
// website's URL conventions and typia pack into `createWorkerCompiler`.

import {
  createTypiaSourcePackMount,
  createWorkerCompiler,
} from "@ttsc/playground";
import { WorkerServer } from "tgrid";

const service = createWorkerCompiler({
  wasmUrl: "/compiler/playground.wasm",
  wasmExecUrl: "/compiler/wasm_exec.js",
  apiName: "ttscPlayground",
  typiaPlugin: {
    mount: createTypiaSourcePackMount({ url: "/compiler/typia-pack.json" }),
  },
});

const main = async (): Promise<void> => {
  const worker = new WorkerServer();
  await worker.open(service);
};

void main();
