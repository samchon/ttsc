import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  fs,
  path,
  waitForPluginBinary,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual wait loop with a seeded binary and no lock and observes published.
 * @evidence contracts/testing.md#independent-expectations The authored binary path establishes publication independently; literal published rejects unnecessary reacquisition.
 * @evidence contracts/testing.md#distinguishing-cases Pins publication precedence over missing-lock release, without claiming the inert bytes are a working executable.
 * @evidence contracts/testing.md#execution-ownership A unit test calling waitForPluginBinary directly with an existing placeholder binary file and a lock path that does not exist; no lease is taken, the wait loop returns at its first binary check, and no process, build or host is involved.
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
