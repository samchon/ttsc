import { createDescriptorEvaluationProject } from "../../../internal/ttsc/internal/descriptor-evaluation";
import { assert, fs, path } from "../../../internal/ttsc/internal/project";

/**
 * Verifies a load in the default cache root records its use of a reused
 * descriptor evaluation and collects the evaluations nobody uses.
 *
 * `descriptors/` gained one file per key and nothing removed any
 * (samchon/ttsc#1562). The default root now collects it with the plugin
 * binaries, and a hit records a use, so an answer launches keep reusing is not
 * evicted by its age.
 *
 * 1. Load a project whose descriptor declares it reads nothing, in the default
 *    project-local cache root.
 * 2. Age its recorded evaluation past the retention window, add another aged
 *    entry, and let the daily collection run again.
 * 3. Load again, and assert the evaluation was reused, its entry survives with a
 *    fresh use, and the other entry is gone.
 *
 * @evidence contracts/testing.md#behavioral-verification A reused descriptor executes once, retains its aged entry with renewed use, and removes a separate aged unused record.
 * @evidence contracts/testing.md#independent-expectations An independently counted factory and manually aged records distinguish valid reuse from recomputation or collection of live entries.
 * @evidence contracts/testing.md#distinguishing-cases 1. Load a project whose descriptor declares it reads nothing, in the default project-local cache root. 2. Age its recorded evaluation past the retention window, add another aged entry, and let the daily collection run again. 3. Load again, and assert the evaluation was reused, its entry survives with a fresh use, and the other entry is gone.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner uses the actual descriptor evaluator, default-cache selection and later native source-cache maintenance dispatch through createDescriptorEvaluationProject. Scripted Go publication is not real compiler semantics.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution Both loads keep the same factory/counter/default node_modules cache. After the first load, only used/unused record timestamps and the collection marker change; counter1 independently distinguishes descriptor reuse. It is not a total process/Program count or certified native publication cache hit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared helper retains its tracked root before preparation and removes inherited TTSC_CACHE_DIR from its call-local env only. Original 31-day timestamp inputs and collection-marker removal remain within the owned default root; synchronous return does not establish arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Original collected names, initial one JSON record, 31-day aging of used and authored unused {} record, exact marker deletion, counter1, unused absent, used present and newer used mtime remain. Unused {} is not another validated evaluator result. Actual runtime/default selection/manifest/survival unverified; donor retained.
 */
export const test_loadprojectplugins_keeps_used_descriptor_evaluations_and_collects_unused_ones =
  () => {
    const project = createDescriptorEvaluationProject(
      "ttsc-descriptor-collection-",
      {},
      [
        `  return {`,
        `    hostInputHashes: {},`,
        `    name: "collected",`,
        `    source: path.join(context.dirname, "go-plugin"),`,
        `  };`,
      ].join("\n"),
      { defaultCacheRoot: true },
    );
    assert.equal(project.load(), "collected");
    const descriptors = path.join(project.cacheRoot, "descriptors");
    const entries = fs
      .readdirSync(descriptors)
      .filter((name) => name.endsWith(".json"));
    assert.equal(entries.length, 1, entries.join(", "));
    const used = path.join(descriptors, entries[0]!);
    const unused = path.join(descriptors, "unused.json");
    fs.writeFileSync(unused, "{}", "utf8");
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    for (const file of [used, unused]) fs.utimesSync(file, old, old);
    fs.rmSync(path.join(descriptors, ".gc-last-run"), { force: true });

    assert.equal(project.load(), "collected");
    assert.equal(project.evaluations(), 1, "the evaluation was not reused");
    assert.equal(fs.existsSync(unused), false, "an unused entry was kept");
    assert.equal(fs.existsSync(used), true, "an entry in use was collected");
    assert.ok(
      fs.statSync(used).mtimeMs > old.getTime(),
      "the hit recorded no use",
    );
  };
