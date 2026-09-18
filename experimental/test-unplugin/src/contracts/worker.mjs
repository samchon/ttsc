import {
  esbuildContract,
  farmContract,
  rollupContract,
  webpackContract,
} from "./bundlers.mjs";
import { bunContract, nextContract } from "./frameworks.mjs";
import {
  predicateContract,
  watchEsbuild,
  watchFarm,
  watchRollupLike,
  watchWebpackLike,
} from "./predicates.mjs";
import { reactRouterContract, viteContract } from "./vite.mjs";

const host = process.argv[2];
// Each watching build host also runs the compiler-predicate matrix
// (samchon/ttsc#1388) through its own watcher.
if (["rollup", "rolldown"].includes(host)) {
  await rollupContract(host);
  await predicateContract(host, watchRollupLike(host));
} else if (["webpack", "rspack"].includes(host)) {
  await webpackContract(host);
  await predicateContract(host, watchWebpackLike(host));
} else if (host === "esbuild") {
  await esbuildContract();
  await predicateContract(host, watchEsbuild);
} else if (host === "farm") {
  await farmContract();
  await predicateContract(host, watchFarm);
} else if (host === "vite7" || host === "vite8") await viteContract(host);
else if (host === "react-router") await reactRouterContract();
else if (host.startsWith("next-")) await nextContract(host.slice(5));
else if (host === "bun") await bunContract();
else throw new Error(`Unknown host ${host}`);
