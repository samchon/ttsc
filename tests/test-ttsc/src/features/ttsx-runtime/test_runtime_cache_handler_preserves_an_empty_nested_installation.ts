import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { TestProject } from "../../../../utils/src/TestProject";
import { assertNoAncestorWorkspace } from "../../internal/assertNoAncestorWorkspace";
import { withCapturedTtscCacheCommand } from "../../internal/withCapturedTtscCacheCommand";

/**
 * Query the real cache source handler before and after its supported marker write.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual runTtsc cache paths JSON selects the empty nearer node_modules before and after SourceBuildCacheLayout publishes its owned cache marker; the populated ancestor cannot replace that installation identity.
 * @evidence contracts/testing.md#independent-expectations The authored physical test/node_modules/.cache/ttsc path is the literal expected root independently of the returned cache descriptor and marker writer.
 * @evidence contracts/testing.md#distinguishing-cases A nearer empty installation contrasts with the populated ancestor; its actual marker transition must retain placement. The original runtime marker, successful program and project-cache cleanup are external execution observations, not inferred from this policy query.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry calls the actual synchronous cache dispatcher and layout writer with controlled restored stream/environment inputs. No ttsx run, compiler build or test-created child/worker occurs; root cleanup failures are retained alongside assertion failures.
 */
export function test_runtime_cache_handler_preserves_an_empty_nested_installation(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("cache-handler-nested-"));
  TestProject.writeFiles(root, {
    "package.json": '{"name":"cache-parent","private":true}',
    "node_modules/dependency/package.json": '{"name":"dependency"}',
    "test/tsconfig.json": '{"files":["main.ts"]}',
    "test/main.ts": "export const value = 1;\n",
  });
  const expected = path.join(root, "test", "node_modules", ".cache", "ttsc");
  const failures: unknown[] = [];
  const query = (identity: string): void => {
    const result = withCapturedTtscCacheCommand(root, ["cache", "paths", "--json", "--cwd", root, "--project", "test/tsconfig.json"]);
    try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(new Error(identity + "/status", { cause: error })); }
    try { assert.equal((JSON.parse(result.stdout) as { cacheRoot: string }).cacheRoot, expected); } catch (error) { failures.push(new Error(identity + "/root", { cause: error })); }
  };
  try {
    assertNoAncestorWorkspace(root);
    fs.mkdirSync(path.join(root, "test", "node_modules"));
    query("before marker");
    fs.mkdirSync(expected, { recursive: true });
    SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(expected);
    query("after marker");
  } catch (error) { failures.push(error); }
  finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch (error) { failures.push(error); } }
  if (failures.length) throw new AggregateError(failures, "Nested cache handler assertions failed");
}
