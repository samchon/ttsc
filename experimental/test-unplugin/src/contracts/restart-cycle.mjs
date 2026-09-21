import assert from "node:assert/strict";

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
 * `compiles: false` when the session must compile nothing.
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

const before = project.runs();
const session = await sessions[host](project);
try {
  if (expectation.kind === "settled") {
    await session.settled(expectation.label, expectation.value, []);
  } else {
    await session.failed(expectation.label, new RegExp(expectation.pattern));
  }
  if (expectation.compiles === false) {
    assert.equal(
      project.runs(),
      before,
      "a restart over an unchanged project serves every module from the cache",
    );
  }
  // Proven while the host runs: a host stopped by a signal stores nothing
  // more, and a step that rebuilt from nothing would prove nothing.
  await eventually(
    () => session.stored(),
    Boolean,
    `${host}: ${expectation.label}: the persistent cache is stored`,
  );
} finally {
  await session.close();
}
