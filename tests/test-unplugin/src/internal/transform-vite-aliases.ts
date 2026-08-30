import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Asserts that a bundler alias map passed as the fourth argument to
 * `transformTtsc` is forwarded to the ttsc transform as
 * `compilerOptions.paths`, verified by the fixture plugin's `assert-paths`
 * operation. The expected target is the absolute alias replacement: the
 * generated tsconfig lives in a temp directory where TypeScript-Go rejects bare
 * relative targets (TS5090), so the overlay writes absolute ones.
 *
 * Plugin options sit at the entry top level — the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object, so a nested
 * `config: {...}` object would make the fixture fall back to its default
 * operation and the assertion would never run.
 */
async function assertTransformPassesBundlerAliases() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "assert-paths",
          key: "@lib",
          target: path.join(root, "src", "modules").replace(/\\/g, "/"),
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);

  // A `find` written with a trailing slash keeps today's outcome, which
  // samchon/ttsc#1315 asks for by name: the slash is stripped, so `"@trail/"`
  // reaches the compile under the key `"@trail"` and its `"@trail/*"` wildcard,
  // the same pair a slashless `find` produces. Left unpinned, a reader could
  // reasonably think the two spellings give different keys.
  const trailing = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "assert-paths",
          key: "@trail",
          target: path.join(root, "src", "modules").replace(/\\/g, "/"),
        },
      ],
    }),
    [{ find: "@trail/", replacement: path.join(root, "src", "modules") }],
  );
  assert.ok(trailing);
  assert.match(trailing.code, /"PLUGIN"/);
}

/**
 * Asserts an alias form a tsconfig `paths` map cannot express is reported
 * rather than silently dropped, and costs the forwardable aliases nothing.
 *
 * Vite's array form accepts a `RegExp` `find`, and `{ find: /^~/ }` is a common
 * way to spell a prefix alias. `paths` has no regular-expression form, so such
 * an alias cannot be translated at all; a `find` containing `*` cannot either,
 * because a `paths` key already reads `*` as its own wildcard. Both used to be
 * dropped in silence while both documents said the adapter "reads the resolved
 * `resolve.alias` and layers it onto the generated config" without qualifying
 * it, so a user whose aliases were ignored had nothing to read that explained
 * why (samchon/ttsc#1315).
 *
 * The consequence was never wrong output — the compile falls back to the
 * tsconfig's own `paths`, and a specifier that resolves for the bundler but not
 * the compiler surfaces as the out-of-program report (samchon/ttsc#1308). But
 * that report names the module, not the alias, so it cannot tell the user that
 * a configuration they wrote was ignored.
 *
 * The string entry sharing the array is the control: a report must not cost the
 * aliases that do forward, and `assert-paths` fails the compile unless `@lib`
 * reached the generated config. The second delivery pins the once-per-process
 * rule, since `resolve.alias` is resolved once and consulted per module, so
 * reporting per delivery would repeat one statement about the config for every
 * file in the bundle.
 */
async function assertUntranslatableAliasesAreReported() {
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

export {
  assertTransformPassesBundlerAliases,
  assertUntranslatableAliasesAreReported,
};
