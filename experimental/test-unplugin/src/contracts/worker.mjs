import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { fixture } from "./common.mjs";
import * as esbuild from "./hosts/esbuild.mjs";
import * as farm from "./hosts/farm.mjs";
import * as next from "./hosts/next.mjs";
import * as rollup from "./hosts/rollup.mjs";
import * as vite from "./hosts/vite.mjs";
import * as webpack from "./hosts/webpack.mjs";
import {
  predicateContract,
  watchEsbuild,
  watchFarm,
  watchRollupLike,
  watchWebpackLike,
} from "./predicates.mjs";
import { runScenarios } from "./scenarios.mjs";
import { reactRouterContract } from "./vite.mjs";

/**
 * One host's whole contract, in a process of its own: the scenario matrix on a
 * project named directly and again on one named through a link, then the
 * compiler-predicate matrix through the host's own watcher
 * (samchon/ttsc#1388).
 */
const host = process.argv[2];

const sessions = {
  rollup: (project) => rollup.openSession("rollup", project),
  rolldown: (project) => rollup.openSession("rolldown", project),
  esbuild: (project) => esbuild.openSession(project),
  webpack: (project) => webpack.openSession("webpack", project),
  rspack: (project) => webpack.openSession("rspack", project),
  farm: (project) => farm.openSession(project),
  vite7: (project) => vite.openSession("vite7", project),
  vite8: (project) => vite.openSession("vite8", project),
  "next-webpack": (project) => next.openSession("webpack", project),
  "next-turbopack": (project) => next.openSession("turbopack", project),
};

/**
 * The roots a host is tried on. Farm's resolver cannot resolve the entry from a
 * root named through a symbolic link ("Can not resolve `./src/main.ts`",
 * measured on Linux and macOS), so a linked root is Farm's to support first; a
 * junction on Windows resolves.
 */
function roots() {
  return host === "farm" && process.platform !== "win32"
    ? [false]
    : [false, true];
}

async function matrix(open) {
  for (const linked of roots()) {
    const project = fixture(linked ? `${host}-linked` : host, { linked });
    project.break();
    const session = await open(project);
    try {
      await runScenarios(project, session);
    } finally {
      await session.close();
    }
  }
}

if (host in sessions) {
  await matrix(sessions[host]);
} else if (host === "bun") {
  for (const linked of roots()) {
    const project = fixture(linked ? "bun-linked" : "bun", { linked });
    project.break();
    await promisify(execFile)(
      "bun",
      [
        fileURLToPath(new URL("./bun-worker.mjs", import.meta.url)),
        project.root,
        linked ? "linked" : "plain",
      ],
      {
        cwd: project.root,
        env: process.env,
        windowsHide: true,
        timeout: 240_000,
      },
    );
  }
} else if (host === "react-router") {
  await reactRouterContract();
} else {
  throw new Error(`Unknown host ${host}`);
}

// Each watching build host also runs the compiler-predicate matrix through its
// own watcher.
if (["rollup", "rolldown"].includes(host)) {
  await predicateContract(host, watchRollupLike(host));
} else if (["webpack", "rspack"].includes(host)) {
  await predicateContract(host, watchWebpackLike(host));
} else if (host === "esbuild") {
  await predicateContract(host, watchEsbuild);
} else if (host === "farm") {
  await predicateContract(host, watchFarm);
}
