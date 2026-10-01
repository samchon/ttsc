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
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The changed settings name reaches the second load and its evaluation count is two when hostInputs lacks a matching hash. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
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
