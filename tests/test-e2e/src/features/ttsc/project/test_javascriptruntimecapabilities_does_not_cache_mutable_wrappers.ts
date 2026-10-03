import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  javascriptRuntimeCapabilities,
  path,
} from "../../../internal/ttsc/internal/project";

/**
 * Verifies runtime capability caching excludes mutable executable wrappers.
 *
 * An absolute wrapper has stable filesystem identity while its environment can
 * redirect execution from Node to a scripted Bun-shaped response, not real Bun. Caching the first child's capabilities
 * by wrapper identity alone pins the wrong descriptor runtime in a long-lived
 * host.
 *
 * 1. Point one stable POSIX wrapper at the current Node executable and probe it.
 * 2. Redirect the unchanged wrapper to a Bun-shaped executable response.
 * 3. Assert the second probe observes the new runtime instead of cached Node.
 *
 * @evidence contracts/testing.md#behavioral-verification javascriptRuntimeCapabilities observes Node then Bun-shaped capability results through the same unchanged POSIX wrapper.
 * @evidence contracts/testing.md#independent-expectations The authored wrapper target selects the real Node or authored Bun-shaped response independently of the capability cache.
 * @evidence contracts/testing.md#distinguishing-cases 1. Point one stable POSIX wrapper at the current Node executable and probe it. 2. Redirect the unchanged wrapper to a Bun-shaped executable response. 3. Assert the second probe observes the new runtime instead of cached Node.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership The generic entry directly calls the built workspace capability owner with an actual selected POSIX wrapper and real/scripted native probe inputs. The scripted Node response is not real Bun, installed consumer, compiler or descriptor-host execution. Original Windows false remains no coverage.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Native selected wrapper inputs belong to the direct probe/cache owner. Exact source unit tests/test-ttsc/src/features/project/test_javascriptruntimecapabilities_does_not_cache_mutable_wrappers.ts is authored in bb123e0160b543dbe6342b194c64b6b0ea65f47f; real subprocess setup alone does not require installed-product E2E. Donor remains until exact direct survivor execution.
 * @evidence contracts/e2e.md#shared-execution Existing two probes reuse the wrapper but receive different call-local target environments. No unchanged-result cache hit, child total or avoided preparation is asserted; actual source-unit selection/runtime remains pending.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked private root is retained before wrapper/probe setup. Mode755 and authored bytes persist while call-local environment selects targets; synchronous probe return is not arbitrary descendant join and no ambient env restoration is needed because it is never mutated here.
 * @evidence contracts/e2e.md#preserved-coverage Original wrapper/script bytes, chmod755, real Node first false/true and authored Bun-shaped second true/false plus Windows no-coverage return remain. The named direct body preserves these observations and Windows false through the existing SKIPPED outcome; actual selection/runtime/survival is unverified, not completed by body existence. No actual Bun or Windows behavioral coverage is certified.
 */
export const test_javascriptruntimecapabilities_does_not_cache_mutable_wrappers =
  (): void | false => {
    if (process.platform === "win32") return false;
    const root = TestProject.tmpdir("ttsc-runtime-wrapper-capability-");
    TestProject.retainTemporaryDirectory(root, "native runtime wrapper probe has no descendant join acknowledgement");
    const wrapper = path.join(root, "runtime-wrapper");
    const alternate = path.join(root, "alternate-runtime");
    fs.writeFileSync(
      wrapper,
      '#!/bin/sh\nexec "$TTSC_TEST_RUNTIME_TARGET" "$@"\n',
      "utf8",
    );
    fs.writeFileSync(
      alternate,
      [
        "#!/usr/bin/env node",
        "process.stdout.write(JSON.stringify({",
        "  bun: true,",
        "  executable: process.argv[1],",
        "  registerHooks: false,",
        "}));",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.chmodSync(wrapper, 0o755);
    fs.chmodSync(alternate, 0o755);

    const first = javascriptRuntimeCapabilities(
      wrapper,
      { ...process.env, TTSC_TEST_RUNTIME_TARGET: process.execPath },
      root,
    );
    assert.equal(first.bun, false);
    assert.equal(first.registerHooks, true);

    const second = javascriptRuntimeCapabilities(
      wrapper,
      { ...process.env, TTSC_TEST_RUNTIME_TARGET: alternate },
      root,
    );
    assert.equal(second.bun, true);
    assert.equal(second.registerHooks, false);
  };
