import assert from "node:assert/strict";
import path from "node:path";

import { createExternalSourceSnapshotLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/createExternalSourceSnapshotLayout";

/**
 * Verifies compact external copies preserve source-relative path geometry.
 *
 * Removing shared ancestors must retain sibling and nested module coordinates;
 * drive and UNC authorities remain distinct without copying their full names.
 *
 * 1. Plan literal Windows and POSIX root populations in both input orders.
 * 2. Assert independent private destinations and relative-path relationships.
 * 3. Verify empty populations and case-distinct components remain separate.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production layout operation and asserts exact source-to-private mappings, nested overlap and sibling geometry rather than checking repository arrangement.
 * @evidence contracts/testing.md#independent-expectations Literal private destinations follow longest-common-component translation; expected sibling distances and distinct drive/share namespaces come from authored source paths.
 * @evidence contracts/testing.md#distinguishing-cases Covers singleton, duplicate, nested and sibling roots, unrelated same-basename roots, multiple drives, UNC shares, case-distinct Windows components, POSIX roots and empty input; reversed order must preserve the plan.
 * @evidence contracts/testing.md#execution-ownership This portable source unit invokes the actual planner with Node's Windows and POSIX path implementations, creates no native project and starts no compiler or subprocess.
 */
export function test_external_source_snapshot_layout_preserves_relative_geometry(): void {
  const populations: {
    paths: typeof path;
    base: string;
    sources: string[];
    expected: [string, string][];
  }[] = [
    {
      paths: path.win32,
      base: "C:\\private\\external",
      sources: [
        "D:\\original\\deep\\dependency",
        "D:\\original\\deep\\dependency",
      ],
      expected: [
        ["D:\\original\\deep\\dependency", "C:\\private\\external\\0"],
      ],
    },
    {
      paths: path.win32,
      base: "C:\\private\\external",
      sources: ["D:\\sdk\\ttsc", "D:\\sdk\\ttsc\\shim\\ast", "D:\\sdk\\lint"],
      expected: [
        ["D:\\sdk\\ttsc", "C:\\private\\external\\0\\ttsc"],
        [
          "D:\\sdk\\ttsc\\shim\\ast",
          "C:\\private\\external\\0\\ttsc\\shim\\ast",
        ],
        ["D:\\sdk\\lint", "C:\\private\\external\\0\\lint"],
      ],
    },
    {
      paths: path.win32,
      base: "C:\\private\\external",
      sources: ["D:\\a\\same", "D:\\b\\same", "E:\\other\\same"],
      expected: [
        ["D:\\a\\same", "C:\\private\\external\\0\\a\\same"],
        ["D:\\b\\same", "C:\\private\\external\\0\\b\\same"],
        ["E:\\other\\same", "C:\\private\\external\\1"],
      ],
    },
    {
      paths: path.win32,
      base: "C:\\private\\external",
      sources: [
        "\\\\server\\one\\deep\\source",
        "\\\\server\\two\\deep\\source",
      ],
      expected: [
        ["\\\\server\\one\\deep\\source", "C:\\private\\external\\0"],
        ["\\\\server\\two\\deep\\source", "C:\\private\\external\\1"],
      ],
    },
    {
      paths: path.win32,
      base: "C:\\private\\external",
      sources: ["D:\\Case\\first", "D:\\case\\second"],
      expected: [
        ["D:\\Case\\first", "C:\\private\\external\\0\\Case\\first"],
        ["D:\\case\\second", "C:\\private\\external\\0\\case\\second"],
      ],
    },
    {
      paths: path.posix,
      base: "/private/external",
      sources: [
        "/checkout/packages/ttsc",
        "/checkout/packages/ttsc/shim/ast",
        "/checkout/packages/lint",
      ],
      expected: [
        ["/checkout/packages/ttsc", "/private/external/0/ttsc"],
        [
          "/checkout/packages/ttsc/shim/ast",
          "/private/external/0/ttsc/shim/ast",
        ],
        ["/checkout/packages/lint", "/private/external/0/lint"],
      ],
    },
  ];
  for (const { paths, base, sources, expected } of populations) {
    for (const population of [sources, [...sources].reverse()]) {
      const actual = createExternalSourceSnapshotLayout(
        base,
        population,
        paths,
      );
      assert.equal(actual.size, expected.length);
      for (const [source, destination] of expected)
        assert.equal(actual.get(source), destination);
      for (const [first, firstCopy] of expected)
        for (const [second, secondCopy] of expected) {
          if (paths.parse(first).root !== paths.parse(second).root) continue;
          assert.equal(
            paths.relative(firstCopy, secondCopy),
            paths.relative(first, second),
          );
        }
    }
  }
  assert.equal(
    createExternalSourceSnapshotLayout("/private", [], path.posix).size,
    0,
  );
}
