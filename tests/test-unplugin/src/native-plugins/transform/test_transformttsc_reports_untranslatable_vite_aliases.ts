import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies a wildcard alias that `paths` cannot express is reported once,
 * without costing the forwardable aliases.
 *
 * A `find` containing `*` cannot be translated, because a `paths` key already
 * reads `*` as its own wildcard. It used to be dropped in silence, so a user
 * whose alias was ignored had nothing explaining why (samchon/ttsc#1315); the
 * out-of-program report names the module, not the alias. `resolve.alias` is
 * resolved once and consulted per module, so the report is once per process.
 * The `RegExp` form is documented and deliberately not reported, because Vite
 * merges its own `RegExp` aliases into every config and a report would fire for
 * aliases the user never wrote.
 *
 * 1. Transform twice with a `RegExp` alias, a wildcard alias, and a forwardable
 *    `@lib` alias, capturing stderr.
 * 2. Assert `@lib` still reached the compile.
 * 3. Assert the wildcard is reported exactly once, and the `RegExp` form not at
 *    all.
 */
export async function test_transformttsc_reports_untranslatable_vite_aliases(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "assert-paths",
        key: "@lib",
        target: path.join(root, "src", "modules").replace(/\\/g, "/"),
      },
    ],
  });
  const aliases = [
    { find: /^~/, replacement: path.join(root, "src") },
    { find: "@glob/*", replacement: path.join(root, "src", "glob") },
    { find: "@lib", replacement: path.join(root, "src", "modules") },
  ];

  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  let result;
  try {
    result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      aliases,
    );
    // Same process, same aliases: the statement is about the configuration, so
    // asking again must not repeat it.
    await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      aliases,
    );
  } finally {
    process.stderr.write = original;
  }

  assert.ok(result);
  assert.match(
    result.code,
    /"PLUGIN"/,
    "a reported alias must not stop the forwardable ones reaching the compile",
  );
  assert.ok(
    captured.includes("@glob/*"),
    `the wildcard alias must be named in the report (got ${JSON.stringify(captured)})`,
  );
  assert.equal(
    captured.split("@glob/*").length - 1,
    1,
    "the report must appear once per process, not once per delivery",
  );
  // The `RegExp` form is documented and deliberately not reported. Vite merges
  // `/^\/?@vite\/env/` and `/^\/?@vite\/client/` into every resolved config, so
  // a report on this form fires twice for every Vite user in every build about
  // aliases they never wrote. This is the assertion that keeps that noise from
  // coming back, and it is why the fixture's own `RegExp` is shaped like one a
  // user would write rather than like Vite's.
  assert.ok(
    !captured.includes("/^~/"),
    `the RegExp form must not be reported (got ${JSON.stringify(captured)})`,
  );
}
