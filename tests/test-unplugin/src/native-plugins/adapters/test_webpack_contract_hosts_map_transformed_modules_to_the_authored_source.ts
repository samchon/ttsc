import { rspack } from "@rspack/core";
import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";

import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { originalPositionFor } from "../../internal/source-map/originalPositionFor";
import { positionOf } from "../../internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";

/**
 * Verifies webpack, Rspack, and Turbopack builds map a ttsc-transformed module
 * back to its authored lines (samchon/ttsc#1392).
 *
 * All three run the transform through webpack's loader contract. unplugin's
 * webpack and Rspack loaders hand a transform's map on only when the module
 * arrived with one, and the ttsc loader runs first, so the bundle's map
 * described the transformed text, and every position after `@ttsc/banner`'s
 * block pointed at the wrong line. The Turbopack loader hands its map to the
 * loader callback itself.
 *
 * 1. Build a banner project's entry with webpack and with Rspack, both with
 *    `devtool: "source-map"`, and assert the output's marker maps back to its
 *    authored line and column.
 * 2. Run the Turbopack loader on the same entry, and assert the map it returns
 *    does the same for its own output.
 */
export async function test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const marker = '"authored-marker"';
  // Plain JavaScript syntax, so neither host needs a type-stripping loader
  // that would compose its own map into the one under test.
  const source = `export const value = ${marker};\n`;
  fs.writeFileSync(project.main, source, "utf8");
  const authored = positionOf(source, marker);

  for (const host of ["webpack", "rspack"] as const) {
    const adapter = await TestUnpluginRuntime.loadUnpluginAdapter(host);
    const output = path.join(project.root, `out-${host}`);
    const config = {
      context: project.root,
      devtool: "source-map" as const,
      entry: project.main,
      mode: "development" as const,
      module: { rules: [{ test: /\.ts$/, type: "javascript/auto" }] },
      output: { filename: "bundle.js", path: output },
      plugins: [adapter()],
      resolve: { extensions: [".ts", ".js"] },
    };
    const compiler: {
      close(callback: () => void): void;
      run(callback: (error: unknown, stats: unknown) => void): void;
    } = host === "webpack" ? webpack(config) : rspack(config);
    const stats = await new Promise<{
      hasErrors(): boolean;
      toString(options: object): string;
    }>((resolve, reject) =>
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result as never),
      ),
    );
    await new Promise<void>((resolve) => compiler.close(() => resolve()));
    assert.equal(stats.hasErrors(), false, stats.toString({ errors: true }));
    const code = fs.readFileSync(path.join(output, "bundle.js"), "utf8");
    const map = JSON.parse(
      fs.readFileSync(path.join(output, "bundle.js.map"), "utf8"),
    );
    const generated = positionOf(code, marker);
    const original = originalPositionFor(map, generated.line, generated.column);
    assert.ok(original, `${host}: the output's marker is mapped`);
    assert.match(original.source, /main\.ts$/, host);
    assert.deepEqual(
      { column: original.column, line: original.line },
      authored,
      `${host}: the marker maps to the line its author wrote`,
    );
  }

  const turbopack = await runTurbopackLoaderWithContext({
    resourcePath: project.main,
    source,
  });
  assert.ok(turbopack.map, "the Turbopack loader returns the map");
  const generated = positionOf(turbopack.content, marker);
  assert.ok(
    generated.line > authored.line,
    "the banner shifts the declaration down",
  );
  assert.deepEqual(
    originalPositionFor(
      turbopack.map as { mappings: string; sources: string[] },
      generated.line,
      generated.column,
    ),
    { ...authored, source: project.main.replace(/\\/g, "/") },
  );
}
