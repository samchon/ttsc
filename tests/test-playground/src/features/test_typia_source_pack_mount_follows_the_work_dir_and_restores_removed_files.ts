import { createMemFS } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { createTypiaSourcePackMount } from "../../../../packages/playground/src/compiler/createTypiaSourcePackMount";
import { installTypiaSourcePack } from "../../../../packages/playground/src/compiler/installTypiaSourcePack";

/**
 * Verifies the typia source-pack mount writes the pack under the directory the
 * compiler resolves from, shares one download, restores removed files, and
 * refuses a pack that is not a map of source text.
 *
 * `typia` must resolve from `<workDir>/node_modules`, so the mount derives its
 * root from the work directory the service forwards, unless the site pinned a
 * root. The download is cached by URL and transport while the writes repeat on
 * every call, so a caller can restore files that were removed from the virtual
 * host without fetching again.
 *
 * 1. Mount for `/proj/` (trailing slash), for no work directory, and for a pinned
 *    mount root that also receives a work directory.
 * 2. Remove a mounted file, mount again, and count the fetches.
 * 3. Offer a non-OK response, an array, and a map with a non-string value, then
 *    succeed on a retry of the same URL.
 *
 * @evidence contracts/testing.md#behavioral-verification createTypiaSourcePackMount writes every pack entry under <workDir>/node_modules with trailing slashes trimmed, under /work/node_modules without a work directory, and under a pinned mount root in preference to the work directory; a repeated mount restores a removed file from one fetch; non-OK and malformed packs reject and are not cached. Reading the bytes back from a real MemFS rejects a pack mounted at the wrong root.
 * @evidence contracts/testing.md#independent-expectations Module resolution of `typia` starts at the project's node_modules, so the root is the work directory plus node_modules; the expected paths and texts are authored with the pack, and the fetch count of one follows from the documented once-per-URL sharing rather than from the cache implementation.
 * @evidence contracts/testing.md#distinguishing-cases A trailing-slash work directory, an absent one and a pinned root contrast for the destination; a first mount contrasts with a remount after removal; a 404, an array and a non-string value contrast with the valid pack, and the retry after those failures shows that none of them was cached.
 * @evidence contracts/testing.md#execution-ownership This entry calls the real mount, installer and loader against createMemFS with injected fetch doubles in the unit process; no browser or network runs. Abort, stalled-body and single-flight behavior of the loader are owned by test_load_typia_source_pack_bounds_and_recovers_cache.
 */
export async function test_typia_source_pack_mount_follows_the_work_dir_and_restores_removed_files(): Promise<void> {
  const pack = { "typia/lib/index.js": "T", "@typia/core/index.js": "C" };
  const respond = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body }) as Response;

  let calls = 0;
  const fetchPack = async (): Promise<Response> => {
    calls++;
    return respond(pack);
  };
  const url = "https://pack.invalid/mount-pack.json";

  const trailing = createMemFS();
  const mount = createTypiaSourcePackMount({ url, fetch: fetchPack });
  await mount(trailing, "/proj/");
  assert.equal(trailing.readFileText("/proj/node_modules/typia/lib/index.js"), "T");
  assert.equal(
    trailing.readFileText("/proj/node_modules/@typia/core/index.js"),
    "C",
  );
  assert.equal(trailing.exists("/work/node_modules"), false);

  const absent = createMemFS();
  await mount(absent);
  assert.equal(absent.readFileText("/work/node_modules/typia/lib/index.js"), "T");

  const pinned = createMemFS();
  await createTypiaSourcePackMount({
    url,
    fetch: fetchPack,
    mountRoot: "/custom/modules",
  })(pinned, "/proj");
  assert.equal(pinned.readFileText("/custom/modules/typia/lib/index.js"), "T");
  assert.equal(pinned.exists("/proj/node_modules"), false);
  assert.equal(calls, 1, "three mounts of one URL and transport fetched once");

  await new Promise<void>((resolve, reject) =>
    trailing.fs.unlink("/proj/node_modules/typia/lib/index.js", (error) =>
      error ? reject(error) : resolve(),
    ),
  );
  assert.equal(trailing.exists("/proj/node_modules/typia/lib/index.js"), false);
  await mount(trailing, "/proj/");
  assert.equal(trailing.readFileText("/proj/node_modules/typia/lib/index.js"), "T");
  assert.equal(calls, 1, "the remount used the loaded records");

  await installTypiaSourcePack(createMemFS(), { url, fetch: fetchPack });
  assert.equal(calls, 1, "the direct installer shares the same load");

  let attempts = 0;
  const responses = [
    respond({}, false, 404),
    respond(["not", "a", "map"]),
    respond({ "typia/index.js": 1 }),
    respond({ "typia/index.js": "R" }),
  ];
  const flaky = async (): Promise<Response> => responses[attempts++]!;
  const flakyUrl = "https://pack.invalid/mount-flaky.json";
  const flakyMount = createTypiaSourcePackMount({ url: flakyUrl, fetch: flaky });
  const target = createMemFS();
  await assert.rejects(flakyMount(target, "/w"), /failed to fetch .*mount-flaky\.json: 404/);
  await assert.rejects(flakyMount(target, "/w"), /expected a source-text record map/);
  await assert.rejects(flakyMount(target, "/w"), /expected a source-text record map/);
  assert.equal(target.exists("/w/node_modules"), false, "a refused pack writes nothing");
  await flakyMount(target, "/w");
  assert.equal(attempts, 4, "each failure was evicted and refetched");
  assert.equal(target.readFileText("/w/node_modules/typia/index.js"), "R");
}
