import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { eventually, projectAt } from "./common.mjs";
import * as farm from "./hosts/farm.mjs";
import * as next from "./hosts/next.mjs";
import * as webpack from "./hosts/webpack.mjs";

/**
 * One session of the restart contract, in a process of its own: a restarted
 * host is a new process, and only a new process starts the adapter over nothing
 * but the host's persistent cache. In one process a second compiler shares the
 * first's generations, and a cache that served nothing would still compile
 * nothing.
 *
 * Arguments: the host, the project root, the plugin mode, and the expectation
 * as JSON: `{ kind: "settled", value }` or `{ kind: "failed", pattern }`, with
 * `compiles` the most compiles the session may run when it must be served from
 * the cache, `live` a value the tsconfig is edited to while the session runs
 * and restored from, and `store: true` when the next session depends on this
 * one's store, which the session then waits for before it stops.
 */
const [host, root, plugin, expectationJson] = process.argv.slice(2);
const expectation = JSON.parse(expectationJson);
const project = projectAt(root, { plugin });

/** A host with a persistent cache, opened over it. */
const sessions = {
  webpack: (project) =>
    webpack.openSession("webpack", project, { cache: true }),
  rspack: (project) => webpack.openSession("rspack", project, { cache: true }),
  farm: (project) => farm.openSession(project, { cache: true }),
  "next-webpack": (project) => next.openSession("webpack", project),
  "next-turbopack": (project) => next.openSession("turbopack", project),
};

/**
 * Every file of the project and its external directory with its state, the tool
 * directory included and the hosts' output left out, so an unexpected compile
 * names what moved since the session that stored the cache.
 */
function projectFiles() {
  const states = {};
  for (const base of [root, `${root}-external`]) {
    let entries = [];
    try {
      entries = fs.readdirSync(base, { recursive: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const name = String(entry);
      const segments = name.split(/[/\\]/);
      if (
        segments.some((segment) =>
          [".next", ".cache", "dist-contract", "node_modules"].includes(
            segment,
          ),
        )
      ) {
        continue;
      }
      try {
        const stats = fs.statSync(path.join(base, name));
        if (stats.isFile()) {
          states[path.join(base, name)] = `${stats.mtimeMs}:${stats.size}`;
        }
      } catch {
        // Gone between the listing and the stat.
      }
    }
  }
  return states;
}

// Beside the project, not below it: the compiler lists the project root, and
// a directory appearing there is a change to the project's state, which the
// next session would rightly compile for.
const recorded = path.join(
  path.dirname(root),
  `${path.basename(root)}-restart-files.json`,
);
const before = project.runs();
const openedAt = Date.now();
const session = await sessions[host](project);
try {
  if (expectation.kind === "settled") {
    await session.settled(expectation.label, expectation.value, []);
  } else {
    await session.failed(expectation.label, new RegExp(expectation.pattern));
  }
  if (expectation.compiles !== undefined) {
    const compiled = project.runs() - before;
    if (compiled > expectation.compiles) {
      let previous = {};
      try {
        previous = JSON.parse(fs.readFileSync(recorded, "utf8"));
      } catch {
        // No earlier session recorded its files.
      }
      const current = projectFiles();
      const moved = Object.keys({ ...previous, ...current }).filter(
        (file) => previous[file] !== current[file],
      );
      const log = (session.output?.() ?? "")
        .split(/\r?\n/)
        .filter((line) => /cache|snapshot|restor|invalid|pack/i.test(line))
        .slice(-120)
        .join("\n");
      assert.fail(
        `a restart over an unchanged project serves every module from the cache: ${compiled} compile(s), at most ${expectation.compiles}; files moved since the stored session: ${JSON.stringify(moved)}\nhost cache log:\n${log}`,
      );
    }
  }
  // An edit while the session runs, to the tsconfig, which no bundler loads:
  // a session served whole from the cache ran the adapter for no module, and
  // hears it only through what the build start handed its observer.
  if (expectation.live !== undefined) {
    project.configure(expectation.live);
    await session.settled(
      `${expectation.label}: tsconfig edited while running`,
      expectation.live,
      [project.tsconfig],
    );
    project.configure(undefined);
    await session.settled(
      `${expectation.label}: tsconfig restored while running`,
      expectation.value,
      [project.tsconfig],
    );
  }
  // Proven while the host runs, for the state this session settled on: a host
  // stopped by a signal stores nothing more. Next's webpack stores on its idle
  // timeout, a minute after a rebuild. A session that compiled nothing changed
  // nothing in the cache, and a host stores nothing for it.
  // A store committed during this session, whichever moment after the build the
  // host commits at, before or after the value settled.
  if (expectation.store === true && project.runs() !== before) {
    await eventually(
      () => session.stored(openedAt),
      Boolean,
      `${host}: ${expectation.label}: the persistent cache is stored`,
      120_000,
    );
  }
} finally {
  await session.close();
}
fs.mkdirSync(path.dirname(recorded), { recursive: true });
fs.writeFileSync(recorded, JSON.stringify(projectFiles()));
