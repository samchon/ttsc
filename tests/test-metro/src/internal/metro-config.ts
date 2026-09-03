import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * A real temp-dir `projectRoot` for config passthrough cases: `withTtsc`
 * prepares the snapshot under the project root (falling back to the working
 * directory), so a config without one would write into the suite's own tree.
 */
function tempProjectRoot(): string {
  return TestProject.tmpdir("ttsc-metro-config-");
}

/**
 * Run `body` with `TTSC_METRO_OPTIONS` saved and restored, so config-level env
 * mutations from {@link withTtsc} never leak into sibling test cases.
 */
async function withCleanEnv(body: () => Promise<void>): Promise<void> {
  const { ENV_KEY } = await TestMetroRuntime.loadOptions();
  const previous = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  try {
    await body();
  } finally {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
  }
}

/** Write a resolvable module and return its absolute path. */
function writeModule(root: string, relative: string, body: string): string {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
  return file;
}

/** Install a fake package under `root`'s `node_modules`, returning its main. */
function writePackage(root: string, name: string, main: string): string {
  const directory = path.join(root, "node_modules", ...name.split("/"));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: name.split("node_modules/").pop(),
      version: "0.0.0",
      main,
    }),
    "utf8",
  );
  return writeModule(directory, main, "module.exports = {};\n");
}

/** The `upstreamTransformer` the last `withTtsc` call published to the worker. */
function publishedUpstream(envKey: string): unknown {
  return JSON.parse(process.env[envKey] as string).upstreamTransformer;
}

/**
 * Asserts `withTtsc` points `transformer.babelTransformerPath` at the package's
 * built transformer module, by absolute path, and that the file exists.
 */
export async function assertWithTtscSetsBabelTransformerPath(): Promise<void> {
  await withCleanEnv(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const config = withTtsc({
      projectRoot: tempProjectRoot(),
      transformer: {},
    });
    const target = config.transformer.babelTransformerPath;
    assert.equal(typeof target, "string");
    assert.equal(path.isAbsolute(target), true);
    assert.match(target, /transformer\.js$/);
    assert.equal(fs.existsSync(target), true);
  });
}

/**
 * Asserts `withTtsc` preserves the rest of the Metro config: unrelated
 * top-level keys and existing `transformer` fields survive untouched while only
 * `babelTransformerPath` is added.
 */
export async function assertWithTtscPreservesExistingConfig(): Promise<void> {
  await withCleanEnv(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const base = {
      projectRoot: tempProjectRoot(),
      resolver: { sourceExts: ["ts", "tsx"] },
      transformer: {
        minifierPath: "metro-minify-terser",
        assetPlugins: ["expo-asset/tools/hashAssetFiles"],
      },
    };
    const config = withTtsc(base);
    assert.equal(config.projectRoot, base.projectRoot);
    assert.deepEqual(config.resolver, base.resolver);
    assert.equal(config.transformer.minifierPath, "metro-minify-terser");
    assert.deepEqual(
      config.transformer.assetPlugins,
      base.transformer.assetPlugins,
    );
    assert.equal(typeof config.transformer.babelTransformerPath, "string");
    // The original object is not mutated in place.
    assert.equal(
      (base.transformer as Record<string, unknown>).babelTransformerPath,
      undefined,
    );
  });
}

/**
 * Asserts `withTtsc` publishes resolved options to the worker env so Metro's
 * transformer processes, which never see the `withTtsc` call, can read them.
 */
export async function assertWithTtscPublishesWorkerEnv(): Promise<void> {
  await withCleanEnv(async () => {
    const { ENV_KEY, resolveOptionsFromEnv } =
      await TestMetroRuntime.loadOptions();
    const { withTtsc } = await TestMetroRuntime.loadIndex();

    const projectRoot = tempProjectRoot();
    withTtsc(
      { projectRoot, transformer: {} },
      { project: "tsconfig.build.json", exclude: ["__tests__"] },
    );
    const configured = JSON.parse(process.env[ENV_KEY] as string);
    assert.equal(configured.project, "tsconfig.build.json");
    assert.deepEqual(configured.exclude, ["__tests__"]);
    assert.match(configured.__snapshotRunId, /^[a-f0-9]{32}$/);
    assert.equal(
      resolveOptionsFromEnv().snapshotRunId,
      configured.__snapshotRunId,
    );

    // No options still publishes the private run handshake, never undefined.
    withTtsc({ projectRoot, transformer: {} });
    const defaults = JSON.parse(process.env[ENV_KEY] as string);
    assert.deepEqual(Object.keys(defaults), ["__snapshotRunId"]);
    assert.match(defaults.__snapshotRunId, /^[a-f0-9]{32}$/);
  });
}

/**
 * Asserts withTtsc adds a `transformer` block even when the input config has
 * none: spreading an absent `transformer` must not crash and must still yield a
 * valid `babelTransformerPath`, while unrelated top-level keys survive.
 */
export async function assertWithTtscAddsTransformerWhenAbsent(): Promise<void> {
  await withCleanEnv(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const projectRoot = tempProjectRoot();
    const config = withTtsc({ projectRoot });
    assert.equal(config.projectRoot, projectRoot);
    assert.equal(typeof config.transformer.babelTransformerPath, "string");
    assert.match(config.transformer.babelTransformerPath, /transformer\.js$/);
  });
}

/**
 * Verifies a transformer the config already declared is chained, in every
 * spelling a config can carry it.
 *
 * `withTtsc` set that one field and read nothing, so a project that had
 * configured its own transformer lost it on the line that adopted this package.
 * Everything else survived — the config and its `transformer` are both spread
 * through — which is what made the loss hard to see (samchon/ttsc#1321).
 * `react-native-svg-transformer`'s whole installation is that single
 * assignment, and losing it fails nothing: `.svg` is not TypeScript, so the
 * ttsc pass hands it to its upstream, and the upstream became the auto-detected
 * Expo default. Green build, wrong components.
 *
 * Chaining is decided on the resolved module, never on the string. Metro
 * resolves this value from the project while the worker resolves
 * `upstreamTransformer` from inside `@ttsc/metro`, so a spelling left relative
 * is looked for where it is not — turning a transformer that used to be ignored
 * into a build that fails outright. Resolving first also lets the
 * self-reference guard recognise this package when a caller named it as a
 * specifier rather than a path, which no string comparison could.
 *
 * The refusals matter as much as the adoptions. The worker options are
 * process-global, so a copy of this package adopted as its own upstream reads
 * the same `TTSC_METRO_OPTIONS`, finds itself named there, and recurses until
 * the stack ends.
 *
 * 1. Drive every spelling of a third-party transformer through `withTtsc`.
 * 2. Drive every spelling that names this package, which must never be adopted.
 * 3. Read each result back out of `TTSC_METRO_OPTIONS`, which is what Metro's
 *    workers actually consult.
 */
export async function assertWithTtscChainsAnExistingTransformer(): Promise<void> {
  await withCleanEnv(async () => {
    const { ENV_KEY } = await TestMetroRuntime.loadOptions();
    const { withTtsc } = await TestMetroRuntime.loadIndex();

    // An absolute path, which is what `require.resolve` produces and what
    // almost every real config carries.
    const absoluteRoot = tempProjectRoot();
    const absolute = writeModule(
      absoluteRoot,
      "vendor/svg-transformer.cjs",
      "module.exports = {};\n",
    );
    const config = withTtsc({
      projectRoot: absoluteRoot,
      transformer: { babelTransformerPath: absolute },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      absolute,
      "the transformer the config already named must become the upstream",
    );
    assert.notEqual(
      config.transformer.babelTransformerPath,
      absolute,
      "and this package's transformer must be the one Metro loads",
    );

    // A project-relative spelling has to be anchored to the project. Left as
    // written it would be looked for inside `@ttsc/metro`, where it is not.
    const relativeRoot = tempProjectRoot();
    const relativeTarget = writeModule(
      relativeRoot,
      "local-transformer.cjs",
      "module.exports = {};\n",
    );
    withTtsc({
      projectRoot: relativeRoot,
      transformer: { babelTransformerPath: "./local-transformer.cjs" },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      relativeTarget,
      "a project-relative path must be anchored to the project before it travels",
    );

    // A bare specifier is a package name. Resolving it from the project is what
    // makes it work under pnpm, where this package lives in a virtual store and
    // walking up from it never reaches the project's own `node_modules`.
    const bareRoot = tempProjectRoot();
    const bareTarget = writePackage(
      bareRoot,
      "react-native-svg-transformer",
      "index.js",
    );
    withTtsc({
      projectRoot: bareRoot,
      transformer: { babelTransformerPath: "react-native-svg-transformer" },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      bareTarget,
      "a bare specifier must be resolved from the project, not from this package",
    );

    // Nothing resolvable: hand the spelling on untouched. It may still resolve
    // in the worker, and if it does not, the upstream loader names it in an
    // error, which is more legible than a path invented here.
    withTtsc({
      projectRoot: tempProjectRoot(),
      transformer: { babelTransformerPath: "no-such-transformer-anywhere" },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      "no-such-transformer-anywhere",
      "an unresolvable specifier must travel exactly as written",
    );

    // An explicit option is the caller saying it outright, so it wins.
    withTtsc(
      {
        projectRoot: absoluteRoot,
        transformer: { babelTransformerPath: absolute },
      },
      { upstreamTransformer: "explicit-upstream" },
    );
    assert.equal(
      publishedUpstream(ENV_KEY),
      "explicit-upstream",
      "an explicit upstreamTransformer must win over the config's value",
    );

    // A config with nothing declared still auto-detects, which is the whole
    // point of the candidate list.
    withTtsc({ projectRoot: tempProjectRoot() });
    assert.equal(
      publishedUpstream(ENV_KEY),
      undefined,
      "a config with no transformer must still auto-detect",
    );

    // Wrapping twice must not make this transformer its own upstream.
    const once = withTtsc({ projectRoot: tempProjectRoot() });
    const twice = withTtsc(once);
    assert.equal(
      publishedUpstream(ENV_KEY),
      undefined,
      "a doubly wrapped config must not delegate into this package's own transformer",
    );
    assert.equal(
      twice.transformer.babelTransformerPath,
      once.transformer.babelTransformerPath,
      "and the transformer Metro loads is unchanged",
    );

    // A second installed copy of this package must be refused too, and this is
    // the row that matters most: adopted, it would recurse into itself on every
    // file. A directory comparison cannot see it, because a differently hoisted
    // `node_modules` is a different directory; the owning `package.json` is
    // what identifies it.
    const duplicateRoot = tempProjectRoot();
    const duplicate = writePackage(
      duplicateRoot,
      "expo/node_modules/@ttsc/metro",
      "lib/transformer.js",
    );
    withTtsc({
      projectRoot: duplicateRoot,
      transformer: { babelTransformerPath: duplicate },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      undefined,
      "another installed copy of @ttsc/metro must never become the upstream",
    );

    // The same package named as a specifier rather than a path. Judging the
    // string would adopt it; judging the resolved module refuses it.
    const specifierRoot = tempProjectRoot();
    writePackage(specifierRoot, "@ttsc/metro", "lib/transformer.js");
    withTtsc({
      projectRoot: specifierRoot,
      transformer: { babelTransformerPath: "@ttsc/metro" },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      undefined,
      "naming this package as a specifier must be refused like naming its path",
    );

    // A third-party module that merely happens to be named `transformer.js` is
    // not ours, and refusing it would drop the very transformer this feature
    // exists to keep.
    const lookalikeRoot = tempProjectRoot();
    const lookalike = writePackage(
      lookalikeRoot,
      "some-other-transformer",
      "lib/transformer.js",
    );
    withTtsc({
      projectRoot: lookalikeRoot,
      transformer: { babelTransformerPath: lookalike },
    });
    assert.equal(
      publishedUpstream(ENV_KEY),
      lookalike,
      "a foreign module named transformer.js must still be chained",
    );
  });
}
