import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { assert } from "../internal/ttsgraph";

/** The package's own source tree, resolved the way the suite resolves its bin. */
const graphRoot = path.dirname(
  createRequire(import.meta.url).resolve("@ttsc/graph/package.json"),
);

const read = (...segments: string[]): string =>
  fs.readFileSync(path.join(graphRoot, ...segments), "utf8");

/** The `@default` typia publishes to the model for a numeric request field. */
const documentedDefault = (source: string, field: string): number | undefined => {
  const match = source.match(
    new RegExp(`@default (\\d+)\\s*\\*/\\s*${field}\\?: number;`),
  );
  return match === null ? undefined : Number(match[1]);
};

/** The value the runner actually falls back to. */
const runnerConstant = (source: string, name: string): number | undefined => {
  const match = source.match(new RegExp(`^const ${name} = (\\d+);$`, "m"));
  return match === null ? undefined : Number(match[1]);
};

/**
 * Verifies each request default the MCP schema publishes is the one the runner
 * applies.
 *
 * The default is written twice — as a JSDoc `@default` typia turns into the
 * tool schema, and as the runner's fallback constant — and the two drifted
 * apart twice, in the same way both times: a commit raised the constant for a
 * benchmark result and left the tag behind. `details.dependencyLimit` said 1
 * and gave 2 (`77dc14d04`), `tour.limit` said 4 and gave 5 (`c5243ad1c`). The
 * schema is the only description of these knobs a model ever reads, so a stale
 * tag is the graph telling the caller something the graph does not do — the
 * same shape as #732, arriving through the request contract instead of the
 * result. Neither drift was visible to anything that runs.
 *
 * This is the gate the pair needs, mirroring the one that holds the dump schema
 * version to its TypeScript reader. Whichever side moves, the other has to
 * follow, and the test says which.
 *
 * 1. Read each structure file and its runner.
 * 2. Extract the documented `@default` and the runner's constant.
 * 3. Assert they agree.
 */
export const test_ttscgraph_request_defaults_match_the_runner_constants = () => {
  const details = read("src", "structures", "ITtscGraphDetails.ts");
  const tour = read("src", "structures", "ITtscGraphTour.ts");
  const runDetails = read("src", "server", "runDetails.ts");
  const runTour = read("src", "server", "runTour.ts");
  const runLookup = read("src", "server", "runLookup.ts");
  const runTrace = read("src", "server", "runTrace.ts");
  const runEntrypoints = read("src", "server", "runEntrypoints.ts");
  const lookup = read("src", "structures", "ITtscGraphLookup.ts");
  const trace = read("src", "structures", "ITtscGraphTrace.ts");
  const entrypoints = read("src", "structures", "ITtscGraphEntrypoints.ts");

  // memberLimit has no numeric default on purpose: an identity list is returned
  // whole, so it is uncapped and the runner reads it through `limitOf`
  // (unlimited when omitted). Pin that invariant rather than a default that no
  // longer exists — a re-added `@default` on it would be the cap creeping back.
  assert.strictEqual(
    documentedDefault(details, "memberLimit"),
    undefined,
    "memberLimit must stay uncapped: an identity list is not sampled",
  );
  assert.ok(
    /memberLimit\s*=\s*limitOf\(/.test(runDetails),
    "runDetails must apply memberLimit through limitOf (unlimited by default)",
  );

  for (const testCase of [
    { field: "neighborLimit", schema: details, runner: runDetails, constant: "DEFAULT_NEIGHBORS" },
    { field: "dependencyLimit", schema: details, runner: runDetails, constant: "DEFAULT_DEPENDENCIES" },
    { field: "limit", schema: tour, runner: runTour, constant: "DEFAULT_LIMIT" },
    { field: "limit", schema: lookup, runner: runLookup, constant: "DEFAULT_LIMIT" },
    { field: "maxDepth", schema: trace, runner: runTrace, constant: "DEFAULT_DEPTH" },
    { field: "maxNodes", schema: trace, runner: runTrace, constant: "DEFAULT_MAX_NODES" },
    { field: "limit", schema: entrypoints, runner: runEntrypoints, constant: "DEFAULT_LIMIT" },
    { field: "neighbors", schema: entrypoints, runner: runEntrypoints, constant: "DEFAULT_NEIGHBORS" },
  ]) {
    const documented = documentedDefault(testCase.schema, testCase.field);
    const applied = runnerConstant(testCase.runner, testCase.constant);
    // A pair that stops being findable is a pair that stops being checked, so
    // the gate fails rather than passing vacuously when either side moves.
    assert.notEqual(
      documented,
      undefined,
      `no \`@default\` on ${testCase.field}; if it moved, this gate must follow it`,
    );
    assert.notEqual(
      applied,
      undefined,
      `no \`const ${testCase.constant}\`; if it moved, this gate must follow it`,
    );
    assert.strictEqual(
      documented,
      applied,
      `${testCase.field} is published as @default ${String(documented)} but ${testCase.constant} applies ${String(applied)}`,
    );
  }
};
