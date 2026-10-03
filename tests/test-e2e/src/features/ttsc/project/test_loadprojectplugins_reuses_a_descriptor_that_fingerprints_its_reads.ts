import { FixtureFiles } from "../../../internal/FixtureFiles";
import { createDescriptorEvaluationProject } from "../../../internal/ttsc/internal/descriptor-evaluation";
import { assert, fs, path } from "../../../internal/ttsc/internal/project";

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
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls workspace loadProjectPlugins and actual isolated descriptor return/cache transport. A counter observes factory evaluations, not child totals; scripted Go where supplied is not real compiler or packed-consumer semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution Three loads preserve the same descriptor/counter/cache/environment: first, first with factory counter1, then settings second with counter2. Factory SHA256 uses the exact bytes read for that result. This is counted evaluator reuse, not process/Program or native publication reuse.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before preparation, directly or by the existing counted-project helper. Call-local environment changes do not mutate ambient state; actual synchronous result/throw does not establish arbitrary descendant join before reset. Default authority alone is not measured cold-cache proof.
 * @evidence contracts/e2e.md#preserved-coverage Original declared settings hash computed from evaluation-time bytes, first/first/counter1 then edit second/counter2 remain without resetting cache/counter or replacing the descriptor. Actual runtime/manifest/survival unverified and donor retained.
 */
export const test_loadprojectplugins_reuses_a_descriptor_that_fingerprints_its_reads =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-declared-read-",
      FixtureFiles.read("ttsc/loadprojectplugins_reuses_a_descriptor_that_fingerprints_its_reads/inputs-1"),
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
