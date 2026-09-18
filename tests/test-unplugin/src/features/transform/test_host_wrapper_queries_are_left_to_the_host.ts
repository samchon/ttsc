import assert from "node:assert/strict";

import { isHostWrapperQuery } from "../../../../../packages/unplugin/lib/core/transform/utils/isHostWrapperQuery.mjs";

/**
 * Verifies exactly the host-generated wrapper queries are recognized, so every
 * other variant of a source module keeps being transformed
 * (samchon/ttsc#1394).
 *
 * `?raw`, `?url`, `?inline`, `?no-inline`, `?worker`, and `?sharedworker` make
 * the host generate a module around the file, and substituting the compiled
 * program for it changed what the import yielded. Cache busting, the worker
 * entry, and framework route chunks denote the file's own program. React
 * Router's `?route-chunk=` splits the code ttsc produced, so skipping it would
 * ship untransformed calls to the client.
 *
 * 1. Evaluate wrapper ids, alone, combined, and before a fragment.
 * 2. Evaluate program ids, including keys that merely contain a wrapper name.
 */
export async function test_host_wrapper_queries_are_left_to_the_host(): Promise<void> {
  for (const id of [
    "/src/schema.ts?raw",
    "/src/schema.ts?url",
    "/src/schema.ts?inline",
    "/src/schema.ts?no-inline",
    "/src/schema.ts?worker",
    "/src/schema.ts?sharedworker",
    "/src/schema.ts?worker&url",
    "/src/schema.ts?t=1700000000000&raw",
    "/src/schema.ts?raw#fragment",
  ])
    assert.equal(isHostWrapperQuery(id), true, id);
  for (const id of [
    "/src/schema.ts",
    "/src/schema.ts?t=1700000000000",
    "/src/schema.ts?v=abc123",
    "/src/schema.ts?import",
    "/src/schema.ts?worker_file&type=module",
    "/src/routes/home.tsx?route-chunk=main",
    "/src/schema.ts?rawdata",
    "/src/schema.ts#raw",
  ])
    assert.equal(isHostWrapperQuery(id), false, id);
}
