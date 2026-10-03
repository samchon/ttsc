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
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner invokes createDescriptorEvaluationProject and actual isolated CommonJS evaluation through the workspace loadProjectPlugins owner. The factory appends x to its real counter before returning a name; scripted Go publication is not real Go compiler semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution The two loads keep the same descriptor bytes, explicit cache, counter and call-local environment. Only settings changes first to second; do not reset the cache/counter between them. Exact factory counter2 is not a total child/Program count or an independently observed native publication cache hit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared helper retains its tracked root before factory/counter/scripted Go preparation. The case changes only its settings file and does not mutate ambient env. Synchronous load return is not arbitrary descendant join; later reset requires actual owned lifetime/manifest evidence.
 * @evidence contracts/e2e.md#preserved-coverage Original settings fixture, factory no external-read declaration, first name, second file edit/name and exact counter2 remain. Direct eligibility policy alone does not replace actual factory return/cache transport; runtime/manifest/survival unverified and donor retained.
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
