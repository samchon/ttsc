import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies alias-named content events recheck an observed file's actual state.
 *
 * Native event names can use a file's short alias. The injected notification
 * models that naming boundary; the input edit and reproof use the actual file.
 * This entry creates no native short name and supplies no polling tick.
 *
 * 1. Register one real ordinary input through explicit watcher and case seams.
 * 2. Emit an unrelated named event while the input is unchanged and require no
 *    reload.
 * 3. Edit the registered file, emit its differently named alias content event and
 *    require exactly its owner to reload, then dispose the observer.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createInputObserver registration and checks compare real before/after input bytes after an alias-named change callback. The owner must reload without relying on a fallback polling tick.
 * @evidence contracts/testing.md#independent-expectations Literal before/after bytes and the authored alias notification describe the required state transition; literal empty and single-owner report lists define expectations independently of path-key or observer selection code.
 * @evidence contracts/testing.md#distinguishing-cases Quiet initial registration and an unrelated event with unchanged input contrast with changed input reported under a different native spelling. This rejects both dropping uncertain names and unconditionally reloading every owner on unrelated names.
 * @evidence contracts/testing.md#execution-ownership A source unit calls the actual input observer with supported watch/poll/case capabilities over real temporary files and waits for its flush. No real watcher, short-name tool, Go process, compiler or host runs; finally disposal owns every handle.
 */
export async function test_input_observer_rechecks_alias_named_content_events(): Promise<void> {
  const root = TestProject.createProject({
    "LongConfig.ts": "export const value = 1;\n",
  });
  const file = path.join(root, "LongConfig.ts");
  const owner = path.join(root, "owner");
  const reports: string[][] = [];
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const observer = createInputObserver(
    ({ reload }) => reports.push([...reload]),
    {
      caseSensitive: () => false,
      poll: () => ({ close: () => undefined }),
      watch: (_root, listener) => {
        emit = listener;
        return { close: () => undefined };
      },
    },
  );
  const settled = async (): Promise<string[][]> => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return reports.splice(0);
  };
  try {
    observer.open(root, false);
    observer.replace(owner, [{ file }]);
    assert.deepEqual(await settled(), []);
    assert.ok(emit);
    emit("change", path.join(root, "unrelated.ts"));
    assert.deepEqual(await settled(), [], "unchanged input remains quiet");
    fs.writeFileSync(file, "export const value = 2;\n");
    emit("change", path.join(root, "SHORT~1.TS"));
    assert.deepEqual(
      await settled(),
      [[owner]],
      "alias event rechecks the changed input",
    );
  } finally {
    await observer.dispose();
  }
}
