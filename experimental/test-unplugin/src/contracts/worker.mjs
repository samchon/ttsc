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
import { test_host_persistent_cache_restart } from "./scenarios/test_host_persistent_cache_restart.mjs";
import { runScenarios, SCENARIOS } from "./scenarios.mjs";
import { unwritableContract } from "./unwritable.mjs";
import { reactRouterContract } from "./vite.mjs";

/**
 * One host's contract in an owned process: its complete linked-producer
 * watcher contract, a source-producer connection/recovery contract, and the
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

// Every host exercises all watcher/race/verdict cases on the linked producer.
// The other transport and root spelling need their own real connection and
// recovery proof, not another Cartesian product of the same state transitions.
// Rollup retains the complete source-transport contract as its shared oracle.
const CONTRACTS = [
  { plugin: "linked", linked: roots().includes(true), complete: true },
  { plugin: "source", linked: false, complete: host === "rollup" },
];

async function matrix(open) {
  for (const { plugin, linked, complete } of CONTRACTS) {
      const project = fixture(
        `${host}${linked ? "-linked" : ""}${plugin === "linked" ? "-program" : ""}`,
        { linked, plugin },
      );
      project.break();
      const session = await open(project);
      try {
        await runScenarios(project, session, complete ? SCENARIOS : SCENARIOS.slice(0, 4));
      } finally {
        await session.close();
      }
  }
}

if (host in sessions) {
  await matrix(sessions[host]);
} else if (host === "bun") {
  for (const { plugin, linked, complete } of CONTRACTS) {
      const project = fixture(
        `bun${linked ? "-linked" : ""}${plugin === "linked" ? "-program" : ""}`,
        { linked, plugin },
      );
      project.break();
      await promisify(execFile)(
        "bun",
        [
          fileURLToPath(new URL("./bun-worker.mjs", import.meta.url)),
          project.root,
          linked ? "linked" : "plain",
          plugin,
          complete ? "complete" : "connection",
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

// A host with a persistent cache is stopped, edited under, and started again
// over that cache, each session in a process of its own; see restarts.mjs.
// The linked plugin, so the verdict steps are observable: a source plugin's
// envelope carries no compiler verdict.
const RESTARTED = [
  "webpack",
  "rspack",
  "farm",
  "next-webpack",
  "next-turbopack",
];
if (RESTARTED.includes(host)) {
  await test_host_persistent_cache_restart({
    project: fixture(`${host}-restart`, { plugin: "linked" }),
    host,
  });
}

// Once more where the host's tool directory cannot be written, on one host per
// way the adapter keeps a record then: webpack's fallback, Farm's fallback or
// its cache turned off, Turbopack's refusal; see unwritable.mjs.
if (["webpack", "farm", "next-turbopack"].includes(host)) {
  await unwritableContract(host);
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
