import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies the Metro transformer moves the upstream AST's locations from the
 * transformed text back to the author's lines (samchon/ttsc#1392).
 *
 * Metro's Babel transformer returns an AST, never a map, and Metro builds the
 * module's map from that AST's `loc` positions against the file it read. The
 * upstream parsed the ttsc output, which `@ttsc/banner` shifted down by its
 * block, so without the adapter's map every position would point at the
 * transformed lines.
 *
 * 1. Create a banner project, and an upstream that returns one node located at
 *    `value` in the text it receives.
 * 2. Transform the entry and assert the upstream saw a shifted `value`.
 * 3. Assert the returned node's location is `value`'s authored line and column.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual banner compilation shifts the upstream parsed value location, then Metro remaps the returned AST start exactly to authored line1 and preserves a valid same-line end.
 * @evidence contracts/testing.md#independent-expectations Literal authored source locates value at source.indexOf(value) on line1; the shifted-line control proves the native transformation actually changed the upstream coordinate system.
 * @evidence contracts/testing.md#distinguishing-cases Positive banner shift contrasts exact restored start and valid end; source-only map reducers retain their separate decision matrix.
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_moves_upstream_locations_to_the_authored_lines executes the built adapter and actual producer/process connection in the E2E runner; its inline body retains every named assertion.
 * @evidence contracts/e2e.md#necessary-boundary The real linked banner host must emit both changed code and a usable map which the built adapter applies to its upstream AST; fabricated mapping pairs cannot establish producer assembly.
 * @evidence contracts/e2e.md#shared-execution One project and banner native host produce code/map together, using the suite shared cache. One locating upstream module and one transform supply all location assertions, without per-node compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The banner config and linked package belong to the tracked project; the upstream module occupies its own tracked directory. Fresh worker options restore after the call and runner cleanup owns temporary/link/cache resources.
 * @evidence contracts/e2e.md#preserved-coverage Original shifted-line, exact start and bounded same-line end assertions remain. Source remapping units own portable map behavior; this boundary retains the real producer-to-AST connection.
 */
export const test_transformer_moves_upstream_locations_to_the_authored_lines =
  async () => {
    TestUnpluginProject.ensureSharedCacheDir();
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-metro-source-map-"),
    );
    const source = 'export const value: string = "x";\nconsole.log(value);\n';
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src", "main.ts"), source);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true }),
    );
    fs.writeFileSync(
      path.join(root, "banner.config.json"),
      JSON.stringify({ text: "Fixture Banner Text" }),
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          plugins: [{ transform: "@ttsc/banner" }],
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
    );
    fs.mkdirSync(path.join(root, "node_modules", "@ttsc"), { recursive: true });
    fs.symlinkSync(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "banner"),
      path.join(root, "node_modules", "@ttsc", "banner"),
      "junction",
    );
    const upstream = path.join(
      TestProject.tmpdir("ttsc-metro-locating-upstream-"),
      "upstream.cjs",
    );
    fs.writeFileSync(
      upstream,
      [
        "exports.transform = async function (params) {",
        '  const before = params.src.slice(0, params.src.indexOf("value")).split("\\n");',
        "  const start = { line: before.length, column: before.at(-1).length };",
        "  const end = { line: start.line, column: start.column + 5 };",
        "  return {",
        "    ast: {",
        '      type: "File",',
        '      program: { type: "Program", body: [{ type: "Identifier", name: "value", loc: { start, end } }] },',
        "      shifted: start.line,",
        "    },",
        "  };",
        "};",
        "",
      ].join("\n"),
    );

    const result = await TestMetroRuntime.runTransform({
      options: { upstreamTransformer: upstream },
      params: {
        filename: "src/main.ts",
        options: { projectRoot: root },
        src: source,
      },
    });
    assert.ok(
      (result.ast.shifted as number) > 1,
      "the banner shifted the text the upstream parsed",
    );
    type Position = { column: number; line: number };
    const [node] = (
      result.ast.program as {
        body: { loc: { end: Position; start: Position } }[];
      }
    ).body;
    const { end, start } = node!.loc;
    assert.deepEqual(start, { column: source.indexOf("value"), line: 1 });
    assert.ok(
      end.line === 1 && end.column >= start.column,
      `the end stays on the authored line, at or after the start: ${JSON.stringify(end)}`,
    );
  };
