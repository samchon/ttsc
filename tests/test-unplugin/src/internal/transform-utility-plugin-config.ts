import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Shared scenarios for utility-plugin config discovery through the generated
 * alias tsconfig.
 *
 * Any bundler alias makes `transformTtsc` compile through a generated tsconfig
 * in the system temp directory that `extends` the project one. These scenarios
 * pin that `@ttsc/strip` / `@ttsc/banner` config-file discovery and relative
 * `configFile` resolution still anchor at the real project (via the launcher's
 * `TTSC_PLUGIN_CONFIG_DIR` channel), not at the temp directory.
 */

/** Source whose `logger.trace` call is stripped only by the project config. */
const STRIP_SOURCE = [
  "const logger = { trace(message: string): void { void message; } };",
  'logger.trace("drop");',
  'console.log("kept");',
  'export const value: string = "kept";',
  "",
].join("\n");

/**
 * Custom strip config: strips `logger.trace` (which the built-in defaults do
 * not) and nothing else (the defaults would strip `console.log`). Both
 * directions of the assertion therefore distinguish "project config honored"
 * from "silently fell back to defaults".
 */
const STRIP_CONFIG = JSON.stringify({
  calls: ["logger.trace"],
  statements: [],
});

/** A bundler alias entry; its only job is to force the generated tsconfig. */
function aliasFor(root: string): Record<string, string> {
  return { "@lib": path.join(root, "src", "modules") };
}

/**
 * Symlinks `packages/<name>` into `<root>/node_modules/@ttsc/<name>` so the
 * real utility plugin package is resolvable from the temporary project without
 * a full install. Mirrors the seeding the per-plugin suites use.
 */
export function seedUtilityPlugin(
  root: string,
  name: "banner" | "paths" | "strip",
): void {
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  const target = path.join(TestProject.WORKSPACE_ROOT, "packages", name);
  const link = path.join(linkDir, name);
  try {
    fs.symlinkSync(target, link, "junction");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

/** Create a fixture project wired to one utility plugin. */
function createUtilityPluginProject(props: {
  files?: Record<string, string>;
  plugin: "banner" | "strip";
  pluginEntry?: Record<string, unknown>;
  source: string;
}): string {
  const root = TestUnpluginProject.createProject({
    plugins: [
      { transform: `@ttsc/${props.plugin}`, ...(props.pluginEntry ?? {}) },
    ],
    source: props.source,
  });
  for (const [name, text] of Object.entries(props.files ?? {})) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, "utf8");
  }
  seedUtilityPlugin(root, props.plugin);
  return root;
}

/**
 * Asserts that a bundler alias does not detach `@ttsc/strip` from the project's
 * `strip.config.json`: the configured call list is honored and the built-in
 * defaults are NOT applied.
 */
async function assertAliasOverlayHonorsProjectStripConfig() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
  // The defaults strip console.log; the project config must win instead.
  assert.match(result.code, /console\.log\("kept"\)/);
}

/**
 * Asserts the positive twin: with and without the alias, the strip output is
 * byte-identical, so the generated-tsconfig lane and the passthrough lane agree
 * on the project's strip config.
 */
async function assertAliasOverlayMatchesNoAliasStripOutput() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const withAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );
  const withoutAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(withAlias);
  assert.ok(withoutAlias);
  assert.doesNotMatch(withoutAlias.code, /logger\.trace\("drop"\)/);
  assert.equal(withAlias.code, withoutAlias.code);
}

/**
 * Asserts that a bundler alias does not make `@ttsc/banner` fail with "no
 * banner.config found": the project's config file is discovered and its banner
 * text lands in the transformed source.
 */
async function assertAliasOverlayDiscoversProjectBannerConfig() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "Fixture Banner Text" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.match(result.code, /Fixture Banner Text/);
}

/** Assert a persistent generation reloads an implicitly discovered config. */
async function assertPersistentBannerConfigEditInvalidatesTransform() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "OLD BANNER" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD BANNER/);

  fs.writeFileSync(
    path.join(root, "banner.config.json"),
    JSON.stringify({ text: "NEW BANNER" }),
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.match(second.code, /NEW BANNER/);
  assert.doesNotMatch(second.code, /OLD BANNER/);
}

/**
 * Assert persistent generations include modules evaluated by native utility
 * config loaders, even when those modules live outside the project walk.
 *
 * 1. Configure banner and strip through `.cjs` and `.ts` files that exercise
 *    external, extensionless, package-main, ancestor, and NODE_PATH
 *    resolution.
 * 2. Edit only a helper or create a superseding module-resolution candidate,
 *    leaving descriptors, configs, and TypeScript project files untouched.
 * 3. Assert every candidate replaces the generation and selects new output.
 */
async function assertPersistentUtilityConfigDependencyEditInvalidatesTransform() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();

  for (const { format, plugin } of [
    { format: "cjs", plugin: "banner" },
    { format: "ts", plugin: "banner" },
    { format: "cjs", plugin: "strip" },
    { format: "ts", plugin: "strip" },
  ] as const) {
    const root = createUtilityPluginProject({
      plugin,
      source:
        plugin === "banner"
          ? 'export const value: string = "kept";\n'
          : STRIP_SOURCE,
    });
    const externalRoot = TestProject.tmpdir(
      `ttsc-${plugin}-${format}-external-config-`,
    );
    const externalDirectory = path.join(externalRoot, "nested");
    const external = path.join(externalDirectory, `selection.${format}`);
    const externalManifest = path.join(externalRoot, "package.json");
    const nearerManifestCandidate = path.join(
      externalDirectory,
      "package.json",
    );
    fs.mkdirSync(nearerManifestCandidate, { recursive: true });
    fs.writeFileSync(
      externalManifest,
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    const config = path.join(root, `${plugin}.config.${format}`);
    const importedExternal =
      format === "ts"
        ? external.slice(0, -path.extname(external).length)
        : external;
    const specifier = path
      .relative(path.dirname(config), importedExternal)
      .split(path.sep)
      .join("/");
    const explicitSelection = path.join(externalDirectory, "explicit.tsx");
    const explicitSpecifier = path
      .relative(
        path.dirname(config),
        explicitSelection.slice(0, -path.extname(explicitSelection).length) +
          ".js",
      )
      .split(path.sep)
      .join("/");
    if (format === "ts") {
      fs.writeFileSync(explicitSelection, "export default true;\n", "utf8");
    }
    fs.writeFileSync(
      config,
      format === "cjs"
        ? `module.exports = require(${JSON.stringify(external)});\n`
        : `import selection from ${JSON.stringify(specifier.startsWith(".") ? specifier : `./${specifier}`)};\nimport explicit from ${JSON.stringify(explicitSpecifier.startsWith(".") ? explicitSpecifier : `./${explicitSpecifier}`)};\nif (!explicit) throw new Error("explicit JavaScript substitution failed");\nexport default selection;\n`,
      "utf8",
    );
    const configValue = (phase: "NEW" | "OLD") =>
      plugin === "banner"
        ? `{ text: ${JSON.stringify(`${phase} NATIVE INPUT`)} }`
        : phase === "OLD"
          ? '{ calls: ["logger.trace"], statements: [] }'
          : '{ calls: ["console.log"], statements: [] }';
    const moduleText = (phase: "NEW" | "OLD") =>
      format === "cjs"
        ? `module.exports = ${configValue(phase)};\n`
        : `export default ${configValue(phase)};\n`;
    fs.writeFileSync(external, moduleText("OLD"), "utf8");

    const file = TestUnpluginProject.mainFile(root);
    const source = TestUnpluginProject.mainSource(root);
    const cache = createTtscTransformCache();
    const first = await transformTtsc(
      file,
      source,
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(first);
    const firstGeneration = [...cache.values()][0];
    const cached = (await firstGeneration) as {
      result?: {
        hostInputHashes?: Record<string, string | null>;
        hostInputs?: string[];
      };
    };
    assert.ok(
      cached.result?.hostInputs?.some(
        (input) => path.resolve(input) === path.resolve(external),
      ),
      `${plugin}.${format} omitted its evaluated external config dependency: ${JSON.stringify(cached.result?.hostInputs ?? [])}`,
    );
    assert.ok(
      cached.result?.hostInputs?.some(
        (input) => path.resolve(input) === path.resolve(externalManifest),
      ),
      `${plugin}.${format} omitted the package boundary used to resolve its config dependency`,
    );
    assert.ok(
      cached.result?.hostInputs?.some(
        (input) =>
          path.resolve(input) === path.resolve(nearerManifestCandidate),
      ),
      `${plugin}.${format} stopped at a package.json directory instead of retaining the ancestor manifest`,
    );
    if (format === "ts") {
      assert.ok(
        cached.result?.hostInputs?.some(
          (input) =>
            path.resolve(input) ===
            path.resolve(external.replace(/\.ts$/, ".js")),
        ),
        `${plugin}.ts omitted a superseding extensionless-import candidate`,
      );
      const missingExplicitTs = path.join(externalDirectory, "explicit.ts");
      assert.ok(
        cached.result?.hostInputs?.some(
          (input) => path.resolve(input) === missingExplicitTs,
        ),
        `${plugin}.ts omitted a superseding explicit-JavaScript substitution candidate`,
      );
      assert.equal(cached.result?.hostInputHashes?.[missingExplicitTs], null);
    }
    assert.equal(
      cached.result?.hostInputs?.some((input) =>
        /ttsc-(?:banner|strip)-config-/i.test(input),
      ),
      false,
      `${plugin}.${format} reported an ephemeral config-loader file`,
    );
    if (plugin === "banner") {
      assert.match(first.code, /OLD NATIVE INPUT/);
    } else {
      assert.doesNotMatch(first.code, /logger\.trace\("drop"\)/);
      assert.match(first.code, /console\.log\("kept"\)/);
    }

    fs.writeFileSync(external, moduleText("NEW"), "utf8");
    const second = await transformTtsc(
      file,
      source,
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(second);
    assert.notEqual([...cache.values()][0], firstGeneration);
    if (plugin === "banner") {
      assert.match(second.code, /NEW NATIVE INPUT/);
      assert.doesNotMatch(second.code, /OLD NATIVE INPUT/);
    } else {
      assert.match(second.code, /logger\.trace\("drop"\)/);
      assert.doesNotMatch(second.code, /console\.log\("kept"\)/);
    }
  }

  // A resolved file alone is not the complete resolution input. A nearer
  // package candidate can appear without changing the package that supplied
  // the first generation, so pin that missing candidate before it exists.
  const root = createUtilityPluginProject({
    files: {
      "config/banner.config.cjs": [
        'const packageSelection = require("selection");',
        'const dottedSelection = require("./selection.v1");',
        "module.exports = { text: packageSelection.text + ' | ' + dottedSelection.text };",
        "",
      ].join("\n"),
    },
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
  });
  const rootPackage = path.join(root, "node_modules", "selection");
  const nearerPackage = path.join(root, "config", "node_modules", "selection");
  fs.mkdirSync(rootPackage, { recursive: true });
  fs.mkdirSync(path.dirname(nearerPackage), { recursive: true });
  fs.writeFileSync(
    path.join(rootPackage, "package.json"),
    `\uFEFF${JSON.stringify({ main: "entry" })}`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootPackage, "entry.json"),
    JSON.stringify({ text: "OLD JSON MAIN" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "config", "selection.v1.json"),
    JSON.stringify({ text: "OLD DOTTED JSON" }),
    "utf8",
  );
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD JSON MAIN \| OLD DOTTED JSON/);
  const firstGeneration = [...cache.values()][0];
  const cached = (await firstGeneration) as {
    result?: { hostInputs?: string[] };
  };
  assert.ok(
    cached.result?.hostInputs?.some(
      (input) =>
        path.resolve(input) ===
        path.resolve(path.join(nearerPackage, "package.json")),
    ),
    "banner.cjs omitted the nearer unresolved package candidate",
  );
  assert.ok(
    cached.result?.hostInputs?.some(
      (input) =>
        path.resolve(input) ===
        path.resolve(path.join(rootPackage, "entry.js")),
    ),
    "banner.cjs omitted the package main extension candidate",
  );
  assert.ok(
    cached.result?.hostInputs?.some(
      (input) =>
        path.resolve(input) ===
        path.resolve(path.join(root, "config", "selection.v1.js")),
    ),
    "banner.cjs omitted the dotted CommonJS extension candidate",
  );

  fs.writeFileSync(
    path.join(root, "config", "selection.v1.js"),
    'module.exports = { text: "NEW DOTTED JS" };\n',
    "utf8",
  );
  const dotted = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(dotted);
  const dottedGeneration = [...cache.values()][0];
  assert.notEqual(dottedGeneration, firstGeneration);
  assert.match(dotted.code, /OLD JSON MAIN \| NEW DOTTED JS/);

  fs.writeFileSync(
    path.join(rootPackage, "entry.js"),
    'module.exports = { text: "NEW JS MAIN" };\n',
    "utf8",
  );
  const main = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(main);
  const mainGeneration = [...cache.values()][0];
  assert.notEqual(mainGeneration, dottedGeneration);
  assert.match(main.code, /NEW JS MAIN \| NEW DOTTED JS/);

  fs.mkdirSync(nearerPackage, { recursive: true });
  fs.writeFileSync(
    path.join(nearerPackage, "package.json"),
    JSON.stringify({ main: "index.cjs" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(nearerPackage, "index.cjs"),
    'module.exports = { text: "NEW PACKAGE SHADOW" };\n',
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.notEqual([...cache.values()][0], mainGeneration);
  assert.match(second.code, /NEW PACKAGE SHADOW \| NEW DOTTED JS/);
  assert.doesNotMatch(second.code, /NEW JS MAIN/);

  await assertNodePathPackageCandidateInvalidatesTransform();
}

/** Assert an evaluation-time directory-link retarget cannot bless stale output. */
async function assertPersistentUtilityConfigLinkRetargetInvalidatesTransform() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
  });
  const configDirectory = path.join(root, "config");
  const selectionRoot = TestProject.tmpdir("ttsc-banner-link-selection-");
  const oldTarget = path.join(selectionRoot, "old-selection");
  const newTarget = path.join(selectionRoot, "new-selection");
  const link = path.join(selectionRoot, "selection-link");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(oldTarget, { recursive: true });
  fs.mkdirSync(newTarget, { recursive: true });
  const selectionSource = 'module.exports = require("./value.cjs");\n';
  fs.writeFileSync(
    path.join(oldTarget, "selection.cjs"),
    selectionSource,
    "utf8",
  );
  fs.writeFileSync(
    path.join(newTarget, "selection.cjs"),
    selectionSource,
    "utf8",
  );
  fs.writeFileSync(
    path.join(oldTarget, "value.cjs"),
    'module.exports = { text: "OLD LINK TARGET" };\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(newTarget, "value.cjs"),
    'module.exports = { text: "NEW LINK TARGET" };\n',
    "utf8",
  );
  fs.symlinkSync(
    oldTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.writeFileSync(
    path.join(configDirectory, "banner.config.cjs"),
    [
      'const fs = require("node:fs");',
      `const selected = require(${JSON.stringify(path.join(link, "selection.cjs"))});`,
      "module.exports = () => {",
      `  if (fs.realpathSync.native(${JSON.stringify(link)}) === ${JSON.stringify(fs.realpathSync.native(oldTarget))}) {`,
      `    fs.rmSync(${JSON.stringify(link)}, { force: true, recursive: true });`,
      `    fs.symlinkSync(${JSON.stringify(newTarget)}, ${JSON.stringify(link)}, ${JSON.stringify(process.platform === "win32" ? "junction" : "dir")});`,
      "  }",
      "  return selected;",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const watched: string[] = [];
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(first);
  assert.match(first.code, /OLD LINK TARGET/);
  assert.ok(
    watched.includes(path.join(link, "selection.cjs")),
    "watch registration must preserve the lexical link spelling",
  );
  const firstGeneration = [...cache.values()][0];

  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.notEqual([...cache.values()][0], firstGeneration);
  assert.match(second.code, /NEW LINK TARGET/);
  assert.doesNotMatch(second.code, /OLD LINK TARGET/);

  const secondGeneration = [...cache.values()][0]!;
  const secondGenerationState = await secondGeneration;
  assert.equal(secondGenerationState.result.type, "success");
  const linkedSelection = path.join(link, "selection.cjs");
  assert.ok(secondGenerationState.result.hostInputs?.includes(linkedSelection));
  assert.equal(
    secondGenerationState.result.hostInputRealpaths?.[linkedSelection],
    fs.realpathSync.native(linkedSelection),
  );
  // Filesystem notifications are advisory. Close the exact-input watcher to
  // prove metadata validation independently rejects a same-byte link retarget.
  secondGenerationState.hostInputMutationTracker?.close();
  fs.rmSync(link, { force: true, recursive: true });
  fs.symlinkSync(
    oldTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const third = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(third);
  assert.notEqual([...cache.values()][0], secondGeneration);
  assert.match(third.code, /OLD LINK TARGET/);
  assert.doesNotMatch(third.code, /NEW LINK TARGET/);
}

/** Assert Node's inherited NODE_PATH ordering contributes missing candidates. */
async function assertNodePathPackageCandidateInvalidatesTransform(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "config/banner.config.cjs": 'module.exports = require("selection");\n',
    },
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
  });
  const firstNodePath = TestProject.tmpdir("ttsc-node-path-first-");
  const secondNodePath = TestProject.tmpdir("ttsc-node-path-second-");
  const writePackage = (directory: string, text: string): void => {
    const selected = path.join(directory, "selection");
    fs.mkdirSync(selected, { recursive: true });
    fs.writeFileSync(
      path.join(selected, "package.json"),
      JSON.stringify({ main: "index.cjs" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(selected, "index.cjs"),
      `module.exports = { text: ${JSON.stringify(text)} };\n`,
      "utf8",
    );
  };
  writePackage(secondNodePath, "OLD NODE PATH");
  const previousNodePath = process.env.NODE_PATH;
  process.env.NODE_PATH = [firstNodePath, secondNodePath].join(path.delimiter);
  try {
    const file = TestUnpluginProject.mainFile(root);
    const source = TestUnpluginProject.mainSource(root);
    const cache = createTtscTransformCache();
    const first = await transformTtsc(
      file,
      source,
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(first);
    assert.match(first.code, /OLD NODE PATH/);
    const firstGeneration = [...cache.values()][0];
    const cached = (await firstGeneration) as {
      result?: { hostInputs?: string[] };
    };
    assert.ok(
      cached.result?.hostInputs?.some(
        (input) =>
          path.resolve(input) ===
          path.resolve(path.join(firstNodePath, "selection", "package.json")),
      ),
      "banner.cjs omitted the preceding NODE_PATH package candidate",
    );

    writePackage(firstNodePath, "NEW NODE PATH");
    const second = await transformTtsc(
      file,
      source,
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(second);
    assert.notEqual([...cache.values()][0], firstGeneration);
    assert.match(second.code, /NEW NODE PATH/);
    assert.doesNotMatch(second.code, /OLD NODE PATH/);
  } finally {
    if (previousNodePath === undefined) delete process.env.NODE_PATH;
    else process.env.NODE_PATH = previousNodePath;
  }
}

/**
 * Asserts that a relative `configFile` on a tsconfig-declared plugin entry
 * resolves against the project even when the compile runs through the generated
 * alias tsconfig in the temp directory.
 */
async function assertAliasOverlayResolvesRelativeConfigFile() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "config/banner.config.json": JSON.stringify({
        text: "Relative ConfigFile Banner",
      }),
    },
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.json" },
    source: 'export const value: string = "kept";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.match(result.code, /Relative ConfigFile Banner/);
}

/**
 * Asserts the temp-walk hazard guard: a `strip.config.json` planted in the
 * directory that holds the generated tsconfig's temp tree must NOT be honored —
 * the project's own config wins.
 */
async function assertAliasOverlayIgnoresStripConfigPlantedInTempDir() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  // Redirect the OS temp dir so the generated tsconfig lands under a
  // directory we control, with a hostile strip config planted one level
  // above the generated tree (i.e. exactly on the old discovery walk).
  const plantedTemp = TestProject.tmpdir("ttsc-unplugin-planted-");
  fs.writeFileSync(
    path.join(plantedTemp, "strip.config.json"),
    JSON.stringify({ calls: ["console.log"], statements: [] }),
    "utf8",
  );
  const previous = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  process.env.TMPDIR = plantedTemp;
  process.env.TEMP = plantedTemp;
  process.env.TMP = plantedTemp;
  try {
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions(),
      aliasFor(root),
    );

    assert.ok(result);
    // The planted config strips console.log; the project config keeps it and
    // strips logger.trace instead.
    assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
    assert.match(result.code, /console\.log\("kept"\)/);
  } finally {
    restoreEnv("TEMP", previous.TEMP);
    restoreEnv("TMP", previous.TMP);
    restoreEnv("TMPDIR", previous.TMPDIR);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/**
 * Asserts the same-byte link retarget is rejected with notifications unusable.
 *
 * {@link assertPersistentUtilityConfigLinkRetargetInvalidatesTransform} closes
 * the exact-input watcher, which leaves the generation on the narrow path and
 * proves that path's metadata manifest. A watcher that _failed_ takes the other
 * branch: validation falls back to the complete snapshot, whose out-of-walk
 * comparison records realpaths for graph members only. A universal host input
 * is not a graph member, so a retarget to a byte-identical file would be
 * invisible there unless the fallback proves the universal manifest too.
 */
async function assertUnnotifiedUtilityConfigLinkRetargetInvalidatesTransform() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
  });
  const configDirectory = path.join(root, "config");
  const selectionRoot = TestProject.tmpdir("ttsc-banner-unnotified-link-");
  const oldTarget = path.join(selectionRoot, "old-selection");
  const newTarget = path.join(selectionRoot, "new-selection");
  const link = path.join(selectionRoot, "selection-link");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(oldTarget, { recursive: true });
  fs.mkdirSync(newTarget, { recursive: true });
  // Byte-identical selections: only the physical identity of the selected file
  // differs, so a content comparison alone cannot see the retarget.
  const selectionSource = 'module.exports = require("./value.cjs");\n';
  fs.writeFileSync(
    path.join(oldTarget, "selection.cjs"),
    selectionSource,
    "utf8",
  );
  fs.writeFileSync(
    path.join(newTarget, "selection.cjs"),
    selectionSource,
    "utf8",
  );
  fs.writeFileSync(
    path.join(oldTarget, "value.cjs"),
    'module.exports = { text: "OLD LINK TARGET" };\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(newTarget, "value.cjs"),
    'module.exports = { text: "NEW LINK TARGET" };\n',
    "utf8",
  );
  fs.symlinkSync(
    oldTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.writeFileSync(
    path.join(configDirectory, "banner.config.cjs"),
    [
      `const selected = require(${JSON.stringify(path.join(link, "selection.cjs"))});`,
      "module.exports = () => selected;",
      "",
    ].join("\n"),
    "utf8",
  );

  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const failures: (() => void)[] = [];
  const cache = createTtscTransformCache({
    watch: (_directory: string, _listener: unknown, onError: () => void) => {
      failures.push(onError);
      return { close: () => undefined };
    },
  });
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD LINK TARGET/);
  const firstGeneration = [...cache.values()][0];
  assert.equal(
    (await firstGeneration!).projectSnapshotComplete,
    true,
    "an unprovable generation would recompile for the wrong reason below",
  );

  // Every watcher stops reporting, so validation can only use recorded state.
  assert.ok(failures.length > 0, "the seam must have registered a watcher");
  for (const fail of failures) {
    fail();
  }
  fs.rmSync(link, { force: true, recursive: true });
  fs.symlinkSync(
    newTarget,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "a same-byte retarget of a universal host input must replace the generation",
  );
  assert.match(second.code, /NEW LINK TARGET/);
  assert.doesNotMatch(second.code, /OLD LINK TARGET/);
}

/**
 * Materialize a project two directories below its plugin config.
 *
 * The layout a monorepo produces: the config sits at the workspace root and the
 * package that compiles is nested below it, so discovery finds the config by
 * walking up through a directory that belongs to neither.
 *
 * The middle directory is what makes a scenario built on this fixture prove
 * anything. A config created inside the project root is caught by the adapter's
 * own project-membership snapshot no matter what the plugin reports, so only a
 * config appearing _outside_ that walk isolates the probe reporting.
 */
function createNestedUtilityPluginProject(props: {
  plugin: "banner" | "strip";
  outerConfig?: string;
  source: string;
}): { middle: string; root: string } {
  const outer = TestProject.tmpdir(`ttsc-${props.plugin}-outer-`);
  const middle = path.join(outer, "packages");
  const root = path.join(middle, "app");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "commonjs",
          outDir: "dist",
          plugins: [{ transform: `@ttsc/${props.plugin}` }],
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(path.join(root, "src", "main.ts"), props.source, "utf8");
  if (props.outerConfig !== undefined) {
    fs.writeFileSync(
      path.join(outer, `${props.plugin}.config.json`),
      props.outerConfig,
      "utf8",
    );
  }
  seedUtilityPlugin(root, props.plugin);
  return { middle, root };
}

/**
 * Asserts samchon/ttsc#1271: a banner config appearing nearer the project than
 * the one discovery settled on replaces the generation.
 *
 * Discovery walks upward and stops at the first directory that answers, so
 * every candidate it probed on the way is a path that can change the answer.
 * Reporting only the file it found leaves a cached generation unable to notice
 * a nearer one, and a cold build then disagrees with the warm one about which
 * config the project has.
 */
async function assertPersistentBannerConfigSupersessionInvalidatesTransform() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    outerConfig: JSON.stringify({ text: "OUTER BANNER" }),
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OUTER BANNER/);
  const nearer = path.join(middle, "banner.config.json");
  const cached = (await [...cache.values()][0]!) as {
    result?: { hostInputs?: string[] };
  };
  // The declaration itself, not only its effect: the path has to be in the
  // envelope for a consumer to watch it at all, and asserting the effect alone
  // cannot tell an invalidation apart from a generation that was never
  // reusable.
  assert.ok(
    cached.result?.hostInputs?.some(
      (input) => path.resolve(input) === path.resolve(nearer),
    ),
    `the superseding candidate is missing from the envelope: ${JSON.stringify(cached.result?.hostInputs ?? [])}`,
  );

  fs.writeFileSync(nearer, JSON.stringify({ text: "NEARER BANNER" }), "utf8");
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.match(second.code, /NEARER BANNER/);
  assert.doesNotMatch(second.code, /OUTER BANNER/);
}

/**
 * Asserts an unrelated file in a probed directory does not invalidate anything.
 *
 * The twin of the supersession case. The probes make a set of paths matter that
 * did not before, and a generation that woke for any neighbour of them would
 * trade one defect for a worse one: the config directories are ordinary
 * directories with ordinary traffic.
 */
async function assertUnrelatedFileInAProbedDirectoryKeepsTheGeneration() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    outerConfig: JSON.stringify({ text: "OUTER BANNER" }),
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  const firstGeneration = [...cache.values()][0];

  fs.writeFileSync(
    path.join(middle, "unrelated.json"),
    JSON.stringify({ text: "IGNORED" }),
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );

  assert.ok(second);
  assert.equal(
    [...cache.values()][0],
    firstGeneration,
    "a neighbour of a probed candidate must not replace the generation",
  );
  assert.match(second.code, /OUTER BANNER/);
}

/**
 * Asserts a directory wearing a config file's name leaves the generation
 * reusable.
 *
 * The discovery walk rejects such a directory as a config, but it is not the
 * same observation as an absent path: the host-input contract records an
 * existing directory by a fixed directory-kind digest and its physical path.
 * The producer's digest and the consumer's are two independently maintained
 * constants, and the moment they disagree — or the walk reports the directory
 * as absent — every consumer compares a nil against a digest its own filesystem
 * keeps producing. That is not an invalidation but a permanent one: the
 * generation is refused on every delivery for the rest of its life, which is
 * the shape samchon/ttsc#1245 was filed for.
 *
 * 1. Compile a package whose config directory also carries a _directory_ named
 *    `banner.config.ts`.
 * 2. Assert that path reached the envelope, so the case is about how it was
 *    recorded rather than about it being dropped.
 * 3. Deliver again and assert the generation object is the same one.
 */
async function assertDirectoryShapedConfigCandidateKeepsTheGeneration() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    outerConfig: JSON.stringify({ text: "OUTER BANNER" }),
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  // Beside the config the walk settles on, so the search reaches it, rejects
  // it, and reports it from the directory it stopped in.
  const directory = path.join(path.dirname(middle), "banner.config.ts");
  fs.mkdirSync(directory, { recursive: true });

  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OUTER BANNER/);
  const firstGeneration = [...cache.values()][0];
  const cached = (await firstGeneration!) as {
    result?: { hostInputs?: string[] };
  };
  assert.ok(
    cached.result?.hostInputs?.some(
      (input) => path.resolve(input) === path.resolve(directory),
    ),
    `the directory-shaped candidate is missing from the envelope: ${JSON.stringify(cached.result?.hostInputs ?? [])}`,
  );

  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.equal(
    [...cache.values()][0],
    firstGeneration,
    "a directory wearing a config name must not make the generation unreusable",
  );
  assert.match(second.code, /OUTER BANNER/);
}

/**
 * Asserts the same rule where the search found nothing at all.
 *
 * `@ttsc/strip` falls back to its built-in defaults when no config exists
 * anywhere up the tree, which is the state a config appearing later changes.
 * The defaults strip `console.log`; the config planted here strips
 * `logger.trace` instead, so each direction of the assertion distinguishes "the
 * new config took effect" from "the defaults kept running".
 */
async function assertPersistentStripDefaultsYieldToAnAppearingConfig() {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.doesNotMatch(first.code, /console\.log\("kept"\)/);
  assert.match(first.code, /logger\.trace\("drop"\)/);

  fs.writeFileSync(
    path.join(middle, "strip.config.json"),
    STRIP_CONFIG,
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.doesNotMatch(second.code, /logger\.trace\("drop"\)/);
  assert.match(second.code, /console\.log\("kept"\)/);
}

export {
  assertAliasOverlayDiscoversProjectBannerConfig,
  assertAliasOverlayHonorsProjectStripConfig,
  assertAliasOverlayIgnoresStripConfigPlantedInTempDir,
  assertAliasOverlayMatchesNoAliasStripOutput,
  assertAliasOverlayResolvesRelativeConfigFile,
  assertDirectoryShapedConfigCandidateKeepsTheGeneration,
  assertPersistentBannerConfigEditInvalidatesTransform,
  assertPersistentBannerConfigSupersessionInvalidatesTransform,
  assertPersistentStripDefaultsYieldToAnAppearingConfig,
  assertPersistentUtilityConfigDependencyEditInvalidatesTransform,
  assertPersistentUtilityConfigLinkRetargetInvalidatesTransform,
  assertUnnotifiedUtilityConfigLinkRetargetInvalidatesTransform,
  assertUnrelatedFileInAProbedDirectoryKeepsTheGeneration,
};
