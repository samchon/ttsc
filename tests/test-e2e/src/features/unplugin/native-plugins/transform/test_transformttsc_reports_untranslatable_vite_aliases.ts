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
 *
 * @evidence contracts/testing.md#behavioral-verification Two transformations produce PLUGIN, wildcard @glob/* appears once in stderr, RegExp alias is silent and forwardable @lib reaches native options.
 * @evidence contracts/testing.md#independent-expectations Configured assert-paths producer verifies literal @lib target; independent report count and RegExp absence distinguish warning policy.
 * @evidence contracts/testing.md#distinguishing-cases RegExp, unsupported wildcard and forwardable alias in one config, repeated delivery.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_reports_untranslatable_vite_aliases is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built public transformation invokes actual config discovery/overlay and native compiler or fixture plugin. The assertions establish that the selected config/alias reaches that producer, beyond portable option calculations.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API serve this entry's transformations; related repeats reuse configuration/artifact setup. Changed source/options need separate producer calls only for the distinctions above. Portable option policy is not claimed as a separate native boundary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. Temporary stderr interception is restored in finally. Cache observers are not explicitly disposed on every assertion-failure path; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Two transformations produce PLUGIN, wildcard @glob/* appears once in stderr, RegExp alias is silent and forwardable @lib reaches native options. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
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

  const originalDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "write");
  const original = process.stderr.write;
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
    if (originalDescriptor) Object.defineProperty(process.stderr, "write", originalDescriptor);
    else delete (process.stderr as { write?: typeof process.stderr.write }).write;
    assert.equal(process.stderr.write, original);
    assert.deepEqual(Object.getOwnPropertyDescriptor(process.stderr, "write"), originalDescriptor);
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
