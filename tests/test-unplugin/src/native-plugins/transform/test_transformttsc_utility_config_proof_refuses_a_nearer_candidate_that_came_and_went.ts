import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { samePhysicalPath } from "../../internal/paths/samePhysicalPath";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a banner or strip config loses its generation's proof for a module
 * candidate nearer than the package it resolved, when that candidate appears
 * and disappears while the config evaluates.
 *
 * A bare specifier's lookup reads every search root up to the one whose package
 * it selects. A candidate in a nearer root was read, so its absence is part of
 * what the config's value depends on: had it existed when the resolver looked,
 * the config would have loaded it instead. Its absence is proven by the
 * metadata of its nearest existing ancestor, which such an appearance moves
 * even when the candidate is gone again by the time anything looks at it by
 * name. This is the negative twin of the loaders reporting only the roots up to
 * the selected one (samchon/ttsc#1501): the roots they keep keep that proof.
 *
 * 1. For banner and strip, through a `.cjs` and a `.ts` config, write a project
 *    whose config imports a package installed in the project, which creates and
 *    removes that package in the config directory's own `node_modules` when it
 *    loads.
 * 2. Transform the project's entry into a fresh generation cache.
 * 3. Assert the generation is refused, the nearer candidate is an input without
 *    proof, the selected package keeps its proof, and no candidate of the
 *    package lies outside the project.
 */
export async function test_transformttsc_utility_config_proof_refuses_a_nearer_candidate_that_came_and_went(): Promise<void> {
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
    const nearerModules = path.join(root, "config", "node_modules");
    const nearer = path.join(nearerModules, "selection");
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(
      path.join(installed, "package.json"),
      JSON.stringify({ main: "index.js", name: "selection" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(installed, "index.js"),
      [
        'const fs = require("node:fs");',
        `fs.mkdirSync(${JSON.stringify(nearer)}, { recursive: true });`,
        `fs.rmSync(${JSON.stringify(nearerModules)}, { recursive: true });`,
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

    const error = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions(),
      undefined,
      createTtscTransformCache(),
    ).then(
      () => undefined,
      (caught: unknown) => caught,
    );
    assert.ok(
      error instanceof Error && error.name === "TtscUnstableGenerationError",
      `${plugin}.${format}: the generation is refused, got ${String(error)}`,
    );
    const attempted = (
      error as Error & {
        validation: {
          cached: {
            result?: {
              hostInputHashes?: Record<string, string | null>;
              hostInputs?: string[];
            };
          };
        };
      }
    ).validation.cached.result;
    const inputs = attempted?.hostInputs ?? [];
    const hashes = attempted?.hostInputHashes ?? {};
    const proven = (input: string): boolean =>
      Object.prototype.hasOwnProperty.call(hashes, input);
    const nearerCandidates = inputs.filter((input) => isBelow(input, nearer));
    assert.ok(
      nearerCandidates.length !== 0,
      `${plugin}.${format}: the nearer candidates are inputs`,
    );
    assert.deepEqual(
      nearerCandidates.filter(proven),
      [],
      `${plugin}.${format}: no nearer candidate keeps a proof`,
    );
    const selected = inputs.filter((input) =>
      samePhysicalPath(input, path.join(installed, "index.js")),
    );
    assert.ok(
      selected.length !== 0 && selected.every(proven),
      `${plugin}.${format}: the selected package keeps its proof`,
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

/** Whether a path is a directory or lies below it, compared physically. */
function isBelow(file: string, directory: string): boolean {
  for (let current = path.resolve(file); ; ) {
    if (samePhysicalPath(current, directory)) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}
