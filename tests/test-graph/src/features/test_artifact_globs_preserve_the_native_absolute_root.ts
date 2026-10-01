import assert from "node:assert/strict";
import path from "node:path";
import { watchedBy } from "../../../../packages/graph/src/model/publishedArtifacts";
/**
 * Verifies a wildcard immediately below a native filesystem root watches that root.
 *
 * @evidence contracts/testing.md#behavioral-verification All six pattern descriptors call watchedBy and compare literal directory/depth contracts.
 * @evidence contracts/testing.md#independent-expectations Native path.parse supplies the actual filesystem root; expected fixed prefixes are authored independently of the glob parser.
 * @evidence contracts/testing.md#distinguishing-cases Root shallow/recursive, explicit directory, bare/project-relative and exact-file forms distinguish a root separator from a drive-relative prefix.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry executes the owning source operations in this test process, without installing a consumer, building a native producer or fabricating process protocol replies.
 */

export function test_artifact_globs_preserve_the_native_absolute_root(): void {
  const root = path.parse(process.cwd()).root;
  const cwd = path.join(root, "workspace");
  const rows = [
    [path.join(root, "*.md"), { path: root, recursive: false }],
    [path.join(root, "**", "*.md"), { path: root, recursive: true }],
    [path.join(root, "docs", "*.md"), { path: path.join(root, "docs"), recursive: false }],
    ["*.md", { path: cwd, recursive: false }],
    ["docs/*/readme.md", { path: path.join(cwd, "docs"), recursive: true }],
    ["docs/readme.md", null],
  ] as const;
  const failures: unknown[] = [];
  for (const [pattern, expected] of rows) {
    try { assert.deepEqual(watchedBy(pattern, cwd), expected); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Native root glob matrix failed");
}
