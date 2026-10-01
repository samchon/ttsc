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
 * redirect execution from Node to Bun. Caching the first child's capabilities
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
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual child or host operation exercises the transport and execution result named in this case; direct in-process decision helpers cannot establish that process outcome.
 * @evidence contracts/e2e.md#shared-execution All authored subcases reuse the fixture and available runtime within this named entry; distinct process results or runtime identities retain their required child lifetime, without a consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject fixtures isolate mutable records and runtime identities. Synchronous child completion or existing session cleanup owns process lifetime; temporary roots remain registered with TestProject for exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage javascriptRuntimeCapabilities observes Node then Bun-shaped capability results through the same unchanged POSIX wrapper. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_javascriptruntimecapabilities_does_not_cache_mutable_wrappers =
  (): void | false => {
    if (process.platform === "win32") return false;
    const root = TestProject.tmpdir("ttsc-runtime-wrapper-capability-");
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
