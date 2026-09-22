import assert from "node:assert/strict";

import { AUTOMATIC_RULE_GLOBS } from "../../internal/adapter-next/AUTOMATIC_RULE_GLOBS";
import { LOADER } from "../../internal/adapter-next/LOADER";
import { isTtscLoader } from "../../internal/adapter-next/isTtscLoader";
import { loadNext } from "../../internal/adapter-next/loadNext";
import { loadersOf } from "../../internal/adapter-next/loadersOf";

/**
 * Verifies `withTtsc` wires Turbopack as well as webpack, with the same
 * options.
 *
 * The wrapper injected the webpack plugin and nothing else, so a project on
 * Turbopack got no transform at all and no error: the build succeeded and every
 * plugin-driven construct in it survived untransformed into a runtime failure
 * (samchon/ttsc#1310). Turbopack is the default bundler in the Next majors this
 * repository pins, so the covered path was the one fewer users are on. Options
 * must reach both halves identically, since a wrapper that wires two bundlers
 * differently is its own defect.
 *
 * 1. Wrap an empty config with a `project` option.
 * 2. Assert every automatic Turbopack glob routes through the ttsc loader with
 *    those exact options.
 * 3. Assert the webpack hook still injects one plugin.
 */
export async function test_next_adapter_wires_both_bundlers(): Promise<void> {
  const next = await loadNext();
  const options = { project: "tsconfig.build.json" };
  const config = next({}, options);

  const rules = config.turbopack?.rules ?? {};
  for (const glob of AUTOMATIC_RULE_GLOBS) {
    const loaders = loadersOf(rules[glob]);
    assert.ok(
      loaders.some(isTtscLoader),
      `${glob} must route through ${LOADER}`,
    );
    const entry = loaders.find(isTtscLoader) as { options?: unknown };
    assert.deepEqual(
      entry.options,
      options,
      `${glob} must receive the wrapper's own options`,
    );
  }

  // The webpack half is unchanged and must stay so.
  const webpackConfig = config.webpack?.({ plugins: [] }, {}) as {
    plugins: unknown[];
  };
  assert.equal(
    webpackConfig.plugins.length,
    1,
    "the webpack plugin must still be injected",
  );
}
