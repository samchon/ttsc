import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscService } from "../../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../../internal/TestUtilityPlugins";
import { tsgo } from "../../../internal/compiler";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies TtscService transforms files through one resident host.
 *
 * The resident counterpart to `TtscCompiler.transform`: instead of recompiling
 * the project per call, `TtscService` keeps a `serve` host warm and answers
 * per-file requests from it (samchon/ttsc#255). This is the path a Metro worker
 * pool or an editor session reuses, so it must (1) run the linked transform
 * plugins inside the resident host, (2) serve a stable cached result across
 * calls, and (3) report a file outside the program as absent rather than
 * error.
 *
 * Uses the shared utility-plugins fixture (banner/paths/strip share one linked
 * host; lint is a check plugin the resident transform path ignores). Exercises
 * the real native compiler and a Go linked host, so it runs in CI.
 *
 * 1. Copy the fixture project and seed its `@ttsc/*` plugin packages.
 * 2. Transform `src/main.ts` and assert the banner plugin ran in the host.
 * 3. Re-transform the same file and assert an identical (cached) result.
 * 4. Ask for a file outside the program and assert `undefined`; verify concurrent replies.
 * 5. Update the file in the same host and verify edited output and reapplied plugins.
 * 6. Transform and update through a nested directory link, and reject an external linked source.
 * 7. Dispose the host and require later requests to reject.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resident transforms preserve the banner, repeated and concurrent response identity, outside-program absence, then apply edited files through physical/nested linked paths, retain external-link absence and reject requests after disposal.
 * @evidence contracts/testing.md#independent-expectations The literal utility combo banner, unchanged first result, undefined stray results and RESIDENT_EDIT marker with absent join call independently establish identity, routing and replacement rather than deriving expected output from the client.
 * @evidence contracts/testing.md#distinguishing-cases Owns absolute and relative file requests, an un-aborted signal, repeated/pipelined main versus stray replies, incremental physical/nested-link replacement, external linked absence and post-disposal rejection in one host; failed startup compilation remains separate.
 * @evidence contracts/testing.md#execution-ownership The matching named service export owns the original resident, incremental and nested-link scenarios through the actual public TtscService API in the Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The client must frame real native serve requests and match concurrent responses, send buffer updates through the compiler and terminate the child; direct request parsing or source transformation units cannot prove these assembled operations.
 * @evidence contracts/e2e.md#shared-execution The former incremental and nested-link cases now reuse the same copied project, linked contributor binary, loaded Program and resident process; only one service is constructed and no second identical native session is launched.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All unchanged-output and concurrent-routing checks precede the intentional buffer mutation; the edited assertions then observe the same host. An isolated consumer fixture prevents edits leaking, and try/finally always disposes the service even when an assertion fails.
 * @evidence contracts/e2e.md#preserved-coverage Original nonempty/banner, stable-repeat, outside/concurrent replies and disposed-request rejection assertions remain, together with every original incremental before/update/after/banner/no-join and nested-link transform/update/external-absence assertion. Physical-versus-nested alias result equality additionally checks a shared overlay. The old separate incremental and nested-link files are removed only after actual shared-host validation.
 */
export async function test_ttscservice_transforms_a_file_through_the_resident_host(): Promise<void> {
  const root = TestProject.copyProject("ttsc-utility-plugins");
  TestUtilityPlugins.seedPackages(root);
  const alias = path.join(root, "linked-src");
  fs.symlinkSync(path.join(root, "src"), alias, "junction");
  const outside = TestProject.tmpdir("ttsc-service-outside-");
  fs.writeFileSync(
    path.join(outside, "absent.ts"),
    "export const absent = true;\n",
    "utf8",
  );
  const externalAlias = path.join(root, "external-src");
  fs.symlinkSync(outside, externalAlias, "junction");


  const service = new TtscService({
    binary: tsgo,
    cwd: root,
    env: {
      PATH: TestUtilityPlugins.goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  try {
    const first = await service.transformFile(
      path.join(root, "src", "main.ts"),
      { signal: new AbortController().signal },
    );
    assert.ok(first, "resident host returned no output for src/main.ts");
    // The banner is a source-preamble plugin, so its block must appear in the
    // transformed TypeScript exactly once, proof the linked plugins ran
    // inside the resident host, not just a source pass-through.
    TestUtilityPlugins.assertSingleBanner(first, "utility combo");

    // A relative path resolves against the project root, and a second request
    // must return the same cached transform (the host compiled once).
    const second = await service.transformFile("src/main.ts");
    assert.equal(
      second,
      first,
      "resident host should serve a stable cached transform",
    );

    // A file outside the compiled program is absent, not an error.
    const outside = await service.transformFile(path.join(root, "stray.ts"));
    assert.equal(outside, undefined);

    // Concurrent (pipelined) requests stay matched to their own replies: an
    // in-program and an out-of-program request fired together each resolve to
    // their own result, which a FIFO desync would swap.
    const [mainAgain, strayConcurrent] = await Promise.all([
      service.transformFile("src/main.ts"),
      service.transformFile(path.join(root, "stray.ts")),
    ]);
    assert.equal(
      mainAgain,
      first,
      "concurrent in-program request was misrouted",
    );
    assert.equal(
      strayConcurrent,
      undefined,
      "concurrent out-of-program request was misrouted",
    );

    // The same resident host now owns the incremental update scenario.
    const before = first;
    assert.ok(before, "resident host returned no output before the update");
    TestUtilityPlugins.assertSingleBanner(before, "utility combo");
    assert.match(
      before,
      /join\(/,
      "fixture should call join before the edit",
    );

    const updated = await service.updateFile(
      path.join(root, "src", "main.ts"),
      'export const marker: string = "RESIDENT_EDIT";\n',
    );
    assert.equal(
      updated,
      true,
      "the resident host failed to apply the update",
    );

    const after = await service.transformFile("src/main.ts");
    assert.ok(after, "resident host returned no output after the update");
    assert.match(after, /RESIDENT_EDIT/);
    // The plugins re-run on the rebuild, so the banner is still applied once.
    TestUtilityPlugins.assertSingleBanner(after, "utility combo");
    // The edit replaced the original source, so its join call is gone.
    assert.doesNotMatch(after, /join\(/);

    // Resolve nested physical aliases using the same resident Program.
    {
      const file = path.join(alias, "main.ts");
      const before = await service.transformFile(file);
      assert.ok(before, "the linked source was absent from the resident host");
      TestUtilityPlugins.assertSingleBanner(before, "utility combo");

      assert.equal(
        await service.updateFile(
          file,
          'export const marker: string = "NESTED_LINK_EDIT";\n',
        ),
        true,
      );
      assert.match(
        (await service.transformFile(file)) ?? "",
        /NESTED_LINK_EDIT/,
      );
      assert.equal(
        await service.transformFile(path.join(externalAlias, "absent.ts")),
        undefined,
      );
      assert.equal(
        await service.transformFile("src/main.ts"),
        await service.transformFile(file),
        "nested and physical requests must see the same updated overlay",
      );
    }

    // dispose terminates the host and rejects any later request.
    service.dispose();
    await assert.rejects(() => service.transformFile("src/main.ts"));
  } finally {
    service.dispose();
  }
}
