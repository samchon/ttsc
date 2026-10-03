import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
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
 * @evidence contracts/testing.md#distinguishing-cases Positive banner shift contrasts exact restored start and same-line end at or after start. End-token length and all AST node coordinates are not asserted; portable map reducers do not replace this producer-to-returned-location observation.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes this selected native banner/adapter scenario. The default built transformer is used unless TTSC_TEST_LAYER=unit; a source override is not built-boundary proof. An authored locating upstream returns one node rather than starting a real Metro server/OS worker.
 * @evidence contracts/e2e.md#necessary-boundary The real linked banner host must emit both changed code and a usable map which the built adapter applies to its upstream AST; fabricated mapping pairs cannot establish producer assembly.
 * @evidence contracts/e2e.md#shared-execution One copied authored fixture, linked workspace banner package and locating upstream serve one awaited transform through the selected shared producer. This parent call does not count native child, Program or cache populations, and no producer is prepared per AST position.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fixture slot replacement drops earlier recorded inputs; the case creates its own package link and waits for the transform before runtime option env restoration and parent aggregate cleanup. The selected link/path is not an independent loaded-image or descendant witness; no alternate installed package is claimed.
 * @evidence contracts/e2e.md#preserved-coverage Original shifted-line positive, exact authored line1/value-column start and same-line end-column bound remain; no exact end length or broader portable-owner runtime is invented. Real producer-to-AST observation is retained, while registration/built-layer binding/survivor execution/measurement remain unverified.
 */
export async function case_metro_transformer_moves_upstream_locations_to_the_authored_lines(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
    TestUnpluginProject.ensureSharedCacheDir();
    const root = fs.realpathSync.native(
      MetroWorkspace.enterFixture(workspace, "source-map"),
    );
    const source = fs.readFileSync(path.join(root, "src", "main.ts"), "utf8");
    fs.mkdirSync(path.join(root, "node_modules", "@ttsc"), { recursive: true });
    fs.symlinkSync(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "banner"),
      path.join(root, "node_modules", "@ttsc", "banner"),
      "junction",
    );
    const upstream = path.join(root, "upstream.cjs");

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
  }
