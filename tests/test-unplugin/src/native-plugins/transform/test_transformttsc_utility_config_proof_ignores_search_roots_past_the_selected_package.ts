import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { samePhysicalPath } from "../../internal/paths/samePhysicalPath";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a banner or strip config that imports a package keeps its
 * generation's proof when a directory above the project churns while it
 * evaluates, and records no candidate from a search root past the one its
 * package resolved in.
 *
 * A bare specifier is looked up in every `node_modules` from the importer up to
 * the volume root, and the lookup stops at the first root whose package it
 * selects. The config loaders of `@ttsc/banner` and `@ttsc/strip` fingerprinted
 * every root before the resolver ran and reported them all. A missing candidate
 * is proven absent by the metadata of its nearest existing ancestor, so a root
 * past the selected one was proven by a directory such as the shared temporary
 * directory, which any process writing there moves. The input then lost its
 * proof, and `@ttsc/unplugin` declined the generation for a path Node never
 * read. The loaders now share the descriptor evaluators' recorder, which
 * reports only the roots up to the selected one (samchon/ttsc#1501).
 *
 * 1. For banner and strip, through a `.cjs` and a `.ts` config, write a project
 *    whose config imports a package installed in the project, which adds and
 *    removes a directory beside the project when it loads.
 * 2. Transform the project's entry into a fresh generation cache.
 * 3. Assert the generation succeeds, every host input carries its proof, and no
 *    candidate of the package lies outside the project, whose own
 *    `node_modules` selected it.
 */
export async function test_transformttsc_utility_config_proof_ignores_search_roots_past_the_selected_package(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();

  for (const { format, plugin } of [
    { format: "cjs", plugin: "banner" },
    { format: "ts", plugin: "banner" },
    { format: "cjs", plugin: "strip" },
    { format: "ts", plugin: "strip" },
  ] as const) {
    const config = `config/${plugin}.config.${format}`;
    const root = createUtilityPluginProject({
      plugin,
      pluginEntry: { configFile: `./${config}` },
      source:
        plugin === "banner"
          ? 'export const value: string = "kept";\n'
          : STRIP_SOURCE,
    });
    const installed = path.join(root, "node_modules", "selection");
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(
      path.join(installed, "package.json"),
      JSON.stringify({ main: "index.js", name: "selection" }),
      "utf8",
    );
    // Another process writing beside the project, as one writes in a home or
    // temporary directory, while the config evaluates: the package the config
    // imports adds and removes a directory there when it loads.
    const sibling = JSON.stringify(`${root}-sibling`);
    fs.writeFileSync(
      path.join(installed, "index.js"),
      [
        'const fs = require("node:fs");',
        `fs.mkdirSync(${sibling});`,
        `fs.rmdirSync(${sibling});`,
        plugin === "banner"
          ? 'module.exports = { text: "INSTALLED SELECTION" };'
          : 'module.exports = { calls: ["logger.trace"], statements: [] };',
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(installed, "index.d.ts"),
      "declare const selection: object;\nexport = selection;\n",
      "utf8",
    );
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(root, config),
      format === "cjs"
        ? 'module.exports = require("selection");\n'
        : 'import selection from "selection";\nexport default selection;\n',
      "utf8",
    );

    const cache = createTtscTransformCache();
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(result, `${plugin}.${format}: the transform produced output`);
    if (plugin === "banner") assert.match(result.code, /INSTALLED SELECTION/);
    else assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);

    const generation = (await [...cache.values()][0]) as {
      result?: {
        hostInputHashes?: Record<string, string | null>;
        hostInputs?: string[];
      };
    };
    const inputs = generation.result?.hostInputs ?? [];
    const hashes = generation.result?.hostInputHashes ?? {};
    assert.ok(
      inputs.some((input) =>
        samePhysicalPath(input, path.join(installed, "index.js")),
      ),
      `${plugin}.${format}: the selected package is an input`,
    );
    assert.deepEqual(
      inputs.filter(
        (input) => !Object.prototype.hasOwnProperty.call(hashes, input),
      ),
      [],
      `${plugin}.${format}: every input keeps its proof`,
    );
    assert.deepEqual(
      inputs.filter(
        (input) =>
          /node_modules[\\/]selection(?:[\\/]|$)/.test(input) &&
          !isBelow(input, root),
      ),
      [],
      `${plugin}.${format}: no candidate past the selected search root`,
    );
  }
}

/** Whether a path lies below a directory, compared physically. */
function isBelow(file: string, directory: string): boolean {
  let current = path.resolve(file);
  for (;;) {
    const parent = path.dirname(current);
    if (parent === current) return false;
    if (samePhysicalPath(parent, directory)) return true;
    current = parent;
  }
}
