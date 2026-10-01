import { FixtureFiles } from "../../../internal/FixtureFiles";
import { createDescriptorEvaluationProject } from "../../../internal/ttsc/internal/descriptor-evaluation";
import { assert, fs, path } from "../../../internal/ttsc/internal/project";

/**
 * Verifies a descriptor that reads a file without declaring it is evaluated by
 * every load, so an edit to that file reaches the next load.
 *
 * The descriptor evaluation cache proved an answer by the modules and
 * resolution candidates the evaluation recorded and the fingerprints the
 * descriptor declared. A plain `fs.readFileSync` in the factory is none of
 * these, so the cache kept handing out the answer computed from the file's
 * first content for as long as the module graph held still (samchon/ttsc#1561).
 * No runtime ttsc supports can observe the read on every Node release, so an
 * answer is recorded only for a descriptor that declares what it read
 * (`hostInputHashes`).
 *
 * 1. Load a project whose descriptor names itself from `settings.json`, read
 *    without a declaration.
 * 2. Edit `settings.json`, and load again with the same cache.
 * 3. Assert the second load answers the new name and evaluated again.
 *
 * @evidence contracts/testing.md#behavioral-verification The second load returns the changed settings name and the descriptor evaluation counter reaches two when its filesystem read is undeclared.
 * @evidence contracts/testing.md#independent-expectations Authored first and second settings names plus the fixture factory counter distinguish reevaluation from a stale result.
 * @evidence contracts/testing.md#distinguishing-cases 1. Load a project whose descriptor names itself from `settings.json`, read without a declaration. 2. Edit `settings.json`, and load again with the same cache. 3. Assert the second load answers the new name and evaluated again.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The second load returns the changed settings name and the descriptor evaluation counter reaches two when its filesystem read is undeclared. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_evaluates_again_a_descriptor_that_declares_none_of_its_reads =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-undeclared-read-",
      FixtureFiles.read("ttsc/loadprojectplugins_evaluates_again_a_descriptor_that_declares_none_of_its_reads/inputs-1"),
      [
        `  const settings = path.join(context.dirname, "settings.json");`,
        `  return {`,
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
      "the undeclared read was served stale",
    );
    assert.equal(project.evaluations(), 2);
  };
