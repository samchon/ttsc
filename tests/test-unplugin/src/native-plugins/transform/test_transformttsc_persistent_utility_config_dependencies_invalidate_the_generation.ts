import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

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
export async function test_transformttsc_persistent_utility_config_dependencies_invalidate_the_generation(): Promise<void> {
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
