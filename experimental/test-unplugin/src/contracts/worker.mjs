import {
  esbuildContract,
  farmContract,
  rollupContract,
  webpackContract,
} from "./bundlers.mjs";
import { bunContract, nextContract } from "./frameworks.mjs";
import { reactRouterContract, viteContract } from "./vite.mjs";

const host = process.argv[2];
if (["rollup", "rolldown"].includes(host)) await rollupContract(host);
else if (["webpack", "rspack"].includes(host)) await webpackContract(host);
else if (host === "esbuild") await esbuildContract();
else if (host === "farm") await farmContract();
else if (host === "vite7" || host === "vite8") await viteContract(host);
else if (host === "react-router") await reactRouterContract();
else if (host.startsWith("next-")) await nextContract(host.slice(5));
else if (host === "bun") await bunContract();
else throw new Error(`Unknown host ${host}`);
