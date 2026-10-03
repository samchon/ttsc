import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies ttsc utility plugins: shared transform host works when paths is
 * first.
 *
 * Locks the descriptor-order invariant: `@ttsc/paths` is a linked contributor
 * and banner/strip are also linked contributors to the selected aggregate host. Placing
 * `@ttsc/paths` first in the descriptor list must not change host selection or
 * lose the three-contributor composition; this case does not count spawned hosts.
 *
 * 1. Configure plugins with `paths` listed before `banner` and `strip`;
 *    `banner`/`strip` read their `*.config.json` files.
 * 2. Run `ttsc --emit`.
 * 3. Assert a linked-host build announcement names 3 contributors, path aliases were
 *    rewritten, banner was prepended, and `console.log`/`debugger` were
 *    stripped.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual cold linked-host build must report three contributors, emit exactly one banner in JS and declarations, rewrite imports and remove console/debugger.
 * @evidence contracts/testing.md#independent-expectations Literal paths-first banner, three-contributor announcement and relative JS import/drop negatives prescribe composition independently of source identity. A matching build announcement is not an exactly-one-build/process assertion.
 * @evidence contracts/testing.md#distinguishing-cases Owns paths as the first descriptor, banner/strip config discovery, linked host assembly and JS/declaration composition.
 * @evidence contracts/testing.md#execution-ownership The generic named TestExecutor entry invokes the actual workspace launcher with linked contributor checkout packages and a fresh private plugin cache. No packed install, Linux-only selection or independently measured Program/process total is certified.
 * @evidence contracts/e2e.md#necessary-boundary The loader must select one linked host and statically compile all three contributors regardless of descriptor order; semantic units cannot prove that assembled binary ran.
 * @evidence contracts/e2e.md#shared-execution The existing shared Go object cache is supplied, without asserting an object hit. A newly allocated private plugin cache preserves the original build announcement; canonical source/toolchain preparation may be shared while this cold key remains distinct.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh source/config/output and newly allocated private plugin cache preserve the cold-publication input. Owned consumer/plugin cache/shared Go cache are retained before native preparation. Synchronous return/error/signal/status is not native descendant join or actual object reuse.
 * @evidence contracts/e2e.md#preserved-coverage Every original cold-build diagnostic, contributor count, single-banner JS/declaration check, rewritten import and removed-side-effect assertion remains.
 */
export function test_ttsc_utility_plugins_shared_transform_host_works_when_paths_is_first(): void {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsc_utility_plugins_shared_transform_host_works_when_paths_is_first/inputs-1"));
    TestProject.retainTemporaryDirectory(root, "cold linked host return does not acknowledge native descendant closure");
    const pluginCache = TestProject.tmpdir("ttsc-utility-paths-first-");
    TestProject.retainTemporaryDirectory(pluginCache, "cold linked producer inputs have no descendant join acknowledgement");
    TestProject.retainTemporaryDirectory(SHARED_GO_BUILD_CACHE_DIR, "linked host shared Go cache has no descendant join acknowledgement");
    TestUtilityPlugins.seedPackages(root, ["banner", "paths", "strip"]);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: pluginCache,
          TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
        },
      },
    );
    assert.equal(result.error, undefined, "cold linked host launch error");
    assert.equal(result.signal, null, "cold linked host terminated by signal");
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building linked plugin host "linked-plugin-host"/,
    );
    assert.match(result.stderr, /\+ 3 contributor\(s\):/);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    TestUtilityPlugins.assertSingleBanner(js, "paths first");
    TestUtilityPlugins.assertSingleBanner(dts, "paths first");
    assert.match(js, /require\("\.\/modules\/message\.js"\)/);
    assert.doesNotMatch(js, /@lib\/message|console\.log|\bdebugger\b/);
  }
