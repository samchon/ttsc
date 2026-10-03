import assert from "node:assert/strict";

import { isHostWrapperQuery } from "../../../../packages/unplugin/src/core/transform/utils/isHostWrapperQuery";

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
 *
 * @evidence contracts/testing.md#behavioral-verification isHostWrapperQuery recognizes host-generated raw/url/inline/worker wrappers while leaving cache and route-chunk program queries transformable.
 * @evidence contracts/testing.md#independent-expectations Literal true/false ID lists follow wrapper-versus-program ownership; rawdata, fragment-only raw, a `?raw` written after a fragment starts and a differently cased key must not match.
 * @evidence contracts/testing.md#distinguishing-cases Combined keys and a fragment preserve real wrapper recognition; absent query, cache keys, worker_file, route-chunk and name lookalikes are adjacent negatives.
 * @evidence contracts/testing.md#execution-ownership Calls isHostWrapperQuery directly for every literal ID, using that ID as assertion failure identity; it loads no host or project.
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
    "/src/schema.ts#fragment?raw",
    "/src/schema.ts?RAW",
  ])
    assert.equal(isHostWrapperQuery(id), false, id);
}
