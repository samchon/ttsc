import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { TtscService } from "../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { tsgo } from "../../internal/compiler";

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
 * 4. Ask for a file outside the program and assert `undefined`.
 */
export const test_ttscservice_transforms_a_file_through_the_resident_host =
  async () => {
    const root = TestProject.copyProject("ttsc-utility-plugins");
    TestUtilityPlugins.seedPackages(root);
    const service = new TtscService({
      binary: tsgo,
      cwd: root,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-resident-"),
      },
    });
    try {
      const first = await service.transformFile(
        path.join(root, "src", "main.ts"),
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

      // dispose terminates the host and rejects any later request.
      service.dispose();
      await assert.rejects(() => service.transformFile("src/main.ts"));
    } finally {
      service.dispose();
    }
  };
