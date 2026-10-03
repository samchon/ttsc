import { FixtureFiles } from "../../../internal/FixtureFiles";
import { createDescriptorEvaluationProject } from "../../../internal/ttsc/internal/descriptor-evaluation";
import { assert, fs, path } from "../../../internal/ttsc/internal/project";

/**
 * Verifies a descriptor that declares a host input without its fingerprint is
 * evaluated by every load.
 *
 * The protocol reports an input whose state a descriptor could not prove, such
 * as one it observed in two states, by keeping it in `hostInputs` and omitting
 * its `hostInputHashes` entry; `@ttsc/lint` does so for a config it read while
 * the file moved. The descriptor evaluation cache took such an input for one
 * the descriptor had not read and recorded the answer, which then outlived an
 * edit to the file (samchon/ttsc#1561).
 *
 * 1. Load a project whose descriptor names itself from `settings.json`, declaring
 *    it in `hostInputs` alone, next to an empty `hostInputHashes`.
 * 2. Edit `settings.json`, and load again with the same cache.
 * 3. Assert the second load answers the new name and evaluated again.
 *
 * @evidence contracts/testing.md#behavioral-verification The changed settings name reaches the second load and its evaluation count is two when hostInputs lacks a matching hash.
 * @evidence contracts/testing.md#independent-expectations Authored first/second names and an explicitly empty hash map require reevaluation rather than inferring a valid proof from input membership.
 * @evidence contracts/testing.md#distinguishing-cases 1. Load a project whose descriptor names itself from `settings.json`, declaring it in `hostInputs` alone, next to an empty `hostInputHashes`. 2. Edit `settings.json`, and load again with the same cache. 3. Assert the second load answers the new name and evaluated again.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner invokes createDescriptorEvaluationProject and actual isolated CommonJS evaluation through the workspace loadProjectPlugins owner. The factory appends x to its real counter before returning a name; scripted Go publication is not real Go compiler semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution The two loads keep the same descriptor bytes, explicit cache, counter and call-local environment. Only settings changes first to second; do not reset the cache/counter between them. Exact factory counter2 is not a total child/Program count or an independently observed native publication cache hit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared helper retains its tracked root before factory/counter/scripted Go preparation. The case changes only its settings file and does not mutate ambient env. Synchronous load return is not arbitrary descendant join; later reset requires actual owned lifetime/manifest evidence.
 * @evidence contracts/e2e.md#preserved-coverage Original settings fixture, factory hostInputs settings plus empty hostInputHashes, first name, second file edit/name and exact counter2 remain. Direct eligibility policy alone does not replace actual factory return/cache transport; runtime/manifest/survival unverified and donor retained.
 */
export const test_loadprojectplugins_evaluates_again_a_descriptor_with_an_unfingerprinted_host_input =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-unproven-input-",
      FixtureFiles.read("ttsc/loadprojectplugins_evaluates_again_a_descriptor_with_an_unfingerprinted_host_input/inputs-1"),
      [
        `  const settings = path.join(context.dirname, "settings.json");`,
        `  return {`,
        `    hostInputHashes: {},`,
        `    hostInputs: [settings],`,
        `    name: JSON.parse(fs.readFileSync(settings, "utf8")).name,`,
        `    source: path.join(context.dirname, "go-plugin"),`,
        `  };`,
      ].join("\n"),
    );
    assert.equal(project.load(), "first");
    fs.writeFileSync(
      path.join(project.directory, "settings.json"),
      JSON.stringify({ name: "second" }),
    );
    assert.equal(
      project.load(),
      "second",
      "the unproven input was served stale",
    );
    assert.equal(project.evaluations(), 2);
  };
