import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  waitForPluginBinary,
} from "../../internal/source-build";

/**
 * Verifies waitForPluginBinary prefers a published binary over a released lock.
 *
 * Negative twin of the bare `released` outcome: when the holder published its
 * binary and then removed the lock, the waiter must come back with `published`
 * so the caller reuses the binary instead of looping into a redundant
 * acquisition. `released` is reserved for the key being free AND unpublished.
 *
 * 1. Publish a binary file and leave no lock directory.
 * 2. Call the wait loop.
 * 3. Assert it returns `{ outcome: "published" }`.
 */
export const test_waitforpluginbinary_prefers_published_binary_over_released_lock =
  () => {
    const root = TestProject.tmpdir("ttsc-lock-wait-");
    const cacheEntry = path.join(root, "entry");
    fs.mkdirSync(cacheEntry, { recursive: true });
    const binaryPath = path.join(cacheEntry, "plugin.exe");
    fs.writeFileSync(binaryPath, "fake plugin binary\n", "utf8");

    const result = waitForPluginBinary({
      binaryPath,
      lockDir: path.join(root, "entry.lock"),
      lockInfo: {
        label: "source plugin",
        pluginName: "wait-test",
        quiet: true,
      },
      timeoutMs: 600_000,
    });

    assert.deepEqual(result, { outcome: "published" });
  };
