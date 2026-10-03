import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx refuses the options that configure a TypeScript entry's
 * up-front build when the entry is JavaScript, rather than ignoring them.
 *
 * A JavaScript entry has no up-front project build: each TypeScript file it
 * reaches is built through its own project (samchon/ttsc#1569). `--project`, a
 * forwarded compiler option such as `--strict`, `--no-plugins` and the rest
 * would change nothing, so a run that accepted them would silently differ from
 * what was asked. A TypeScript entry keeps accepting them.
 *
 * 1. Give a project a JavaScript script and a compiler response file.
 * 2. Run one request combining strict, project, plugin and response-file options.
 * 3. Assert status 2 names every rejected option and the script never runs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public ttsx transports all four rejected build-policy options in one JavaScript request; status 2, every original option name, JavaScript-entry diagnostic and no script output assert refusal before execution.
 * @evidence contracts/testing.md#independent-expectations A JavaScript entry has no up-front TypeScript build, so explicit project, plugin and compiler/response-file requests cannot be silently accepted; the script's ran literal must never appear.
 * @evidence contracts/testing.md#distinguishing-cases The actual request combines project, no-plugins, strict and response-file policy; source unit test_ttsx_entry_options_preserve_preload_identity_and_reject_only_build_policy separately owns each original spelling and absent/false/zero/empty field boundaries. The shared mixed-preload E2E accepts explicit strict for a typed entry.
 * @evidence contracts/testing.md#execution-ownership This matching named E2E invokes one built public launcher and exits before compiler or program startup; direct authored option parsing/projection runs only in the source-unit population.
 * @evidence contracts/e2e.md#necessary-boundary Pure returned option lists do not prove launcher stderr and status transport or that a rejected JavaScript entry never starts; one aggregate request retains that assembly check.
 * @evidence contracts/e2e.md#shared-execution Four equivalent rejection bootstrap lifetimes are one request, while their policy permutations run in the direct owner unit; the former separate typed compiler host joins the existing mixed-preload typed host with an explicit strict flag.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One isolated immutable script/config/response fixture and synchronous launcher process own the request; no consumer install, native compile, cache transition or mutable program state is shared.
 * @evidence contracts/e2e.md#preserved-coverage All original status-2, each rejected option name, script.js-is-JavaScript and no-ran-output checks remain here; each former individual request has exact source-owner results and the actual successful typed-entry strict branch retains existing mixed-preload output and marker assertions.
 */
export function test_ttsx_refuses_build_options_before_a_javascript_entry() {
  const root = TestProject.commonJsProject(FixtureFiles.read("ttsc/ttsx_refuses_build_options_before_a_javascript_entry/inputs-1"));

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--strict", "-P", "tsconfig.json", "--no-plugins", "@args.txt", "script.js"],
    { cwd: root },
  );
  assert.equal(result.status, 2);
  for (const option of ["--project", "--no-plugins", "--strict", "@args.txt"])
    assert.match(result.stderr, new RegExp(`ttsx: .*${option}`));
  assert.match(result.stderr, /script\.js is JavaScript/);
  assert.doesNotMatch(result.stdout, /ran/);

}
