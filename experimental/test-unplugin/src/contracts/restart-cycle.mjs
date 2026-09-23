import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { eventually, projectAt, recordStates } from "./common.mjs";
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
 * one's store, which the session then waits for before it stops. With
 * `refusedWithoutRecords`, a session whose adapter reported that it could write
 * no record anywhere the host accepts, and turned its cache off, must refuse
 * its modules instead (`unwritable.mjs`).
 */
const [host, root, plugin, expectationJson] = process.argv.slice(2);
// A host whose records the adapter can write nowhere it accepts runs without
// its persistent cache, which the adapter reports as a process warning, and
// then compiles at every start by design (samchon/ttsc#1480). The session
// holds no host to a bound the product declared it cannot meet, and nothing
// else lifts the bound.
let cacheTurnedOff = false;
process.on("warning", (warning) => {
  if (
    warning.code === "TTSC_PROJECT_RECORD_UNWRITABLE" &&
    /persistent cache is turned off/.test(warning.message)
  ) {
    cacheTurnedOff = true;
  }
});
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

/** The files that differ between two listings of the project. */
function movedBetween(previous, current) {
  return Object.keys({ ...previous, ...current }).filter(
    (file) => previous[file] !== current[file],
  );
}

/** What the host wrote, the lines that say what it did with its cache. */
function cacheLines(output) {
  return output
    .split(/\r?\n/)
    .filter((line) =>
      /cache|snapshot|restor|invalid|pack|pass |change reported/i.test(line),
    )
    .slice(-160)
    .join("\n");
}

// Beside the project, not below it: the contract's own files stay out of the
// project whose state it measures.
const recorded = path.join(
  path.dirname(root),
  `${path.basename(root)}-restart-files.json`,
);
// The host's log of the session that stored the cache, beside it: a restart
// that compiled is explained by the pass that session ended on.
const storedLog = path.join(
  path.dirname(root),
  `${path.basename(root)}-restart-host.log`,
);
let previous = {};
try {
  previous = JSON.parse(fs.readFileSync(recorded, "utf8"));
} catch {
  // No earlier session recorded its files.
}
let previousLog = "";
try {
  previousLog = fs.readFileSync(storedLog, "utf8");
} catch {
  // No earlier session recorded its host's log.
}
const atStart = projectFiles();
// The records as the adapter reads them before this session starts: its own
// start moves a record whose proof fails, and its deliveries rewrite one, so
// only a reading taken first says what the stored session left behind.
const recordsAtStart = recordStates(project);
const before = project.runs();
const openedAt = Date.now();
const session = await sessions[host](project);
try {
  if (expectation.refusedWithoutRecords === true && cacheTurnedOff) {
    // No record anywhere the host accepts, as the adapter reported: a watching
    // session refuses its modules, naming the directory (samchon/ttsc#1480).
    await session.failed(expectation.label, /cannot be written/);
  } else if (expectation.kind === "settled") {
    await session.settled(expectation.label, expectation.value, []);
  } else {
    await session.failed(expectation.label, new RegExp(expectation.pattern));
  }
  if (expectation.compiles !== undefined && !cacheTurnedOff) {
    const compiled = project.runs() - before;
    if (compiled > expectation.compiles) {
      assert.fail(
        [
          `a restart over an unchanged project serves every module from the cache: ${compiled} compile(s), at most ${expectation.compiles}`,
          `records as the adapter read them at this session's start: ${JSON.stringify(recordsAtStart)}`,
          `files moved between the stored session and this one: ${JSON.stringify(movedBetween(previous, atStart))}`,
          `files moved during this session: ${JSON.stringify(movedBetween(atStart, projectFiles()))}`,
          `the stored session's host log:\n${cacheLines(previousLog)}`,
          `this session's host log:\n${cacheLines(session.output?.() ?? "")}`,
          ...(session.diagnostics === undefined ? [] : [session.diagnostics()]),
        ].join("\n"),
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
  //
  // Every store must be newer than the host's last build, not merely than the
  // session: a host commits on an idle window of its own, and one that
  // committed before its last build holds that build's predecessor's module
  // snapshots. The next session then rebuilds what this one had already
  // recorded, which is the host's own cache lifecycle rather than anything the
  // adapter registered, and the contract would read it as a failure to serve
  // from the cache. Re-read on every poll, since a build may follow the
  // commit, and bounded by the deadline below.
  // A cache the adapter turned off stores nothing to wait for.
  if (
    expectation.store === true &&
    project.runs() !== before &&
    !cacheTurnedOff
  ) {
    // A host whose cached module snapshots predate the record's last move
    // rebuilds those modules on its next start, however unchanged the
    // project is: the adapter writes the record inside the build that
    // produced it, and the host hears that write itself and runs one more
    // pass, whose snapshots begin after it. A session stopped before that
    // pass stores a cache its successor rebuilds from, which is a session cut
    // short rather than a cache that failed to serve. The wait is for the
    // host's own two facts, its last pass and the record's own time, never
    // for a period of quiet.
    if (session.cacheSettled !== undefined) {
      await eventually(
        () => session.cacheSettled(),
        Boolean,
        `${host}: ${expectation.label}: the host ran a pass after the record moved`,
        30_000,
      ).catch(() => undefined);
    }
    // Thirty seconds: both the webpack and the Next sessions set their
    // cache's idle timeouts to zero, so a store follows a build at once, and
    // a commit that has not landed by then is a host with nothing more to
    // store, which the fallback below reads as such.
    const afterTheBuild =
      session.storedAfterLastBuild === undefined
        ? false
        : await eventually(
            () => session.storedAfterLastBuild(openedAt),
            Boolean,
            `${host}: ${expectation.label}: the persistent cache is stored`,
            30_000,
          ).catch(() => false);
    // A host that committed nothing after its last build had nothing more to
    // store, which its next session reads as the state this one ended on. The
    // wait then falls back to the commit this session made at all, which is
    // what the contract proved before it asked for the stronger one. The
    // stronger proof's deadline only ever weakens the proof to that older one,
    // never past it.
    if (afterTheBuild !== true) {
      // The two minutes the proof had before the stronger one was asked for:
      // a host commits when it commits, and a slow runner has taken over a
      // minute to write one.
      await eventually(
        () => session.stored(openedAt),
        Boolean,
        `${host}: ${expectation.label}: the persistent cache is stored`,
        120_000,
      );
    }
  }
} finally {
  await session.close();
}
fs.mkdirSync(path.dirname(recorded), { recursive: true });
fs.writeFileSync(recorded, JSON.stringify(projectFiles()));
fs.writeFileSync(storedLog, session.output?.() ?? "");
