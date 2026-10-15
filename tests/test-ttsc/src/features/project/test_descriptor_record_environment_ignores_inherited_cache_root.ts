import assert from "node:assert/strict";
import childProcess from "node:child_process";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { descriptorRecordEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/load/descriptorRecordEnvironment";

/**
 * Verifies a descriptor child receives only this load's selected record root.
 *
 * 1. Give an effective environment a stale private root and a case alias.
 * 2. Omit the selected store and confirm the spawned Node child sees no root.
 * 3. Select a different root and confirm the child sees exactly that value.
 *
 * @evidence contracts/testing.md#behavioral-verification Builds the actual descriptor child environment and starts bounded Node children to read the value native process creation receives.
 * @evidence contracts/testing.md#independent-expectations Authored stale and selected root strings define literal absent and selected child output; the original environment must remain unchanged.
 * @evidence contracts/testing.md#distinguishing-cases Absent versus selected cache authority distinguishes inherited stale values from this invocation; a case alias checks Windows native environment identity without changing POSIX's distinct spelling.
 * @evidence contracts/testing.md#execution-ownership This unit starts only two short Node environment readers with explicit child environments; it creates no project, descriptor, compiler, or native artifact.
 */
export function test_descriptor_record_environment_ignores_inherited_cache_root(): void {
  const stale = "stale-record-root";
  const selected = "selected-record-root";
  const inherited = {
    TTSC_PLUGIN_RECORD_ROOT: stale,
    ttsc_plugin_record_root: "stale-alias",
    TTSC_UNRELATED_VALUE: "keep",
  };
  const readChild = (env: NodeJS.ProcessEnv): string => {
    const result = childProcess.spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(process.env.TTSC_PLUGIN_RECORD_ROOT ?? '<absent>')",
      ],
      { encoding: "utf8", env, timeout: 10_000, windowsHide: true },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };

  const absent = descriptorRecordEnvironment(inherited, undefined);
  assert.equal(
    SidecarEnvironment.read(absent, "TTSC_PLUGIN_RECORD_ROOT"),
    undefined,
  );
  assert.equal(readChild(absent), "<absent>");
  assert.equal(absent.TTSC_UNRELATED_VALUE, "keep");
  if (process.platform === "win32")
    assert.equal(Object.hasOwn(absent, "ttsc_plugin_record_root"), false);
  else assert.equal(absent.ttsc_plugin_record_root, "stale-alias");

  const current = descriptorRecordEnvironment(inherited, selected);
  assert.equal(readChild(current), selected);
  assert.equal(current.TTSC_UNRELATED_VALUE, "keep");
  assert.equal(inherited.TTSC_PLUGIN_RECORD_ROOT, stale);
  assert.equal(inherited.ttsc_plugin_record_root, "stale-alias");
}
