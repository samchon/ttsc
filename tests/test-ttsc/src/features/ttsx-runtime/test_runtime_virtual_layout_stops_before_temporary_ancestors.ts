import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "ts-legacy";

import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createFilesystemPathIdentityContext";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies runtime layout discovery excludes ancestors of the temporary root.
 *
 * A caller can place its temporary directory below its project. Comparing only
 * that directory's identity lets discovery climb into shared parents instead.
 *
 * 1. Extract the authored private boundary predicate without running a compiler.
 * 2. Reject the actual temporary root, its parent and the filesystem root.
 * 3. Admit a project below the temporary root and an unrelated sibling.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the exact private isUnsafeVirtualParent declaration with actual filesystem identities and Node os/path modules; a temporary ancestor must stop traversal before unrelated files can enter the runtime layout.
 * @evidence contracts/testing.md#independent-expectations The temporary root and directories containing it are shared boundaries, while a child project and a sibling do not contain it. Native dirname and independently allocated directories establish those relations without consulting the predicate.
 * @evidence contracts/testing.md#distinguishing-cases Equality, strict ancestor, filesystem root, strict descendant and sibling distinguish containment from equality and prevent rejecting all paths on the temporary volume. Existing identity units own alias and case-policy semantics; real launcher connections remain in E2E.
 * @evidence contracts/testing.md#execution-ownership This named source unit extracts one maintained private function with ts-legacy and binds real modules locally. TestProject owns the child directory; no global, environment, compiler, installation or product host is replaced or launched.
 */
export function test_runtime_virtual_layout_stops_before_temporary_ancestors(): void {
  const source = fs.readFileSync(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/src/launcher/internal/prepareExecution.ts",
    ),
    "utf8",
  );
  const parsed = ts.createSourceFile(
    "prepareExecution.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = parsed.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "isUnsafeVirtualParent",
  );
  assert.ok(declaration);
  const javascript = ts.transpileModule(declaration.getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const boundary = new Function(
    "os",
    "path",
    javascript + "\nreturn isUnsafeVirtualParent;",
  )(os, path) as (
    directory: string,
    identities: ReturnType<typeof createFilesystemPathIdentityContext>,
  ) => boolean;
  const temporary = fs.realpathSync.native(os.tmpdir());
  const child = TestProject.physicalPath(TestProject.tmpdir("runtime-layout-"));
  const sibling = path.join(
    path.dirname(temporary),
    path.basename(temporary) + "-unrelated",
  );
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  const failures: Error[] = [];
  for (const [directory, expected] of [
    [temporary, true],
    [path.dirname(temporary), true],
    [path.parse(temporary).root, true],
    [child, false],
    [sibling, false],
  ] as const) {
    try {
      assert.equal(boundary(directory, identities), expected, directory);
    } catch (cause) {
      failures.push(new Error(directory, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "runtime layout boundaries");
}
