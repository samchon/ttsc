import { createDescriptorEvaluationProject } from "../../internal/descriptor-evaluation";
import { assert, fs, path } from "../../internal/project";

/**
 * Verifies a descriptor that declares the file it reads, with the state it read
 * it in, keeps its evaluation across loads until that file changes.
 *
 * An answer is recorded only for a descriptor that declares what it read
 * (samchon/ttsc#1561), and a declared fingerprint proves the answer like a
 * module its graph loaded (samchon/ttsc#1497).
 *
 * 1. Load a project whose descriptor names itself from `settings.json` and
 *    declares it in `hostInputs` with its `hostInputHashes` digest, twice.
 * 2. Edit `settings.json`, and load again with the same cache.
 * 3. Assert the factory ran once for the first two loads and again after the edit,
 *    which the third load answers.
 *
 * @evidence contracts/testing.md#behavioral-verification Two unchanged loads return first with one evaluation; changed declared settings return second with two evaluations.
 * @evidence contracts/testing.md#independent-expectations Authored settings values and the external factory counter distinguish valid hash-backed reuse from recomputation and stale read reuse.
 * @evidence contracts/testing.md#distinguishing-cases 1. Load a project whose descriptor names itself from `settings.json` and declares it in `hostInputs` with its `hostInputHashes` digest, twice. 2. Edit `settings.json`, and load again with the same cache. 3. Assert the factory ran once for the first two loads and again after the edit, which the third load answers.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Two unchanged loads return first with one evaluation; changed declared settings return second with two evaluations. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_reuses_a_descriptor_that_fingerprints_its_reads =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-declared-read-",
      { "settings.json": JSON.stringify({ name: "first" }) },
      [
        `  const settings = path.join(context.dirname, "settings.json");`,
        `  const text = fs.readFileSync(settings);`,
        `  const digest = require("node:crypto").createHash("sha256").update(text).digest("hex");`,
        `  return {`,
        `    hostInputHashes: { [settings]: digest },`,
        `    hostInputs: [settings],`,
        `    name: JSON.parse(text.toString("utf8")).name,`,
        `    source: path.join(context.dirname, "go-plugin"),`,
        `  };`,
      ].join("\n"),
    );
    assert.equal(project.load(), "first");
    assert.equal(project.load(), "first");
    assert.equal(project.evaluations(), 1, "a declared read was not reused");
    fs.writeFileSync(
      path.join(project.directory, "settings.json"),
      JSON.stringify({ name: "second" }),
    );
    assert.equal(project.load(), "second");
    assert.equal(
      project.evaluations(),
      2,
      "an edited declared read was reused",
    );
  };
