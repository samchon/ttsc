import { TestProject } from "@ttsc/testing";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  dependencyCacheLibraryPath,
  fs,
  inspectDependencyBuildLock,
  path,
  reclaimDependencyBuildLock,
  releaseDependencyBuildLock,
  spawnNodeWorker,
  waitForCondition,
} from "../../../internal/ttsc/internal/dependency-cache";

/**
 * Verifies dead-owner recovery and successor fencing across three real workers.
 *
 * A seed exits without releasing its acquired generation. Two contenders read
 * that same fence before either acts. The winner later remains alive while the
 * parent retires it and the other contender acquires a successor; its delayed
 * finalizer must leave that successor untouched.
 *
 * 1. Let both contenders observe the genuinely dead seed, then admit A before B.
 * 2. Require one reclaim and holder, retire A and admit B as its successor.
 * 3. Finalize A while B is live, then finalize B and inspect all retired fences.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built acquisition, inspection, reclaim and release run in a real exited seed, two concurrently live contenders and the parent; exact acquired fences, stale reclaim failure, late release failure and normal successor release are checked.
 * @evidence contracts/testing.md#independent-expectations Actual seed exit establishes death independently of inspection, ready barriers capture the same seed fence before mutation, and acquired A/B leases plus literal release booleans and tombstone paths establish generation authority independently of aggregate counts.
 * @evidence contracts/testing.md#distinguishing-cases A wins before stale B acts; B fails both reclaim and acquisition while A is live, then acquires only after A retirement. A's delayed finalizer fails while B is active; B releases normally and duplicate seed/A retirement remains false.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry owns three real Node worker lifetimes invoking built lease operations and observing genuine local PID death; source units own admission and metadata policy separately.
 * @evidence contracts/e2e.md#necessary-boundary Persisted generation retirement, genuine exited PID recognition and independently alive holders must compose across processes; no fabricated dead PID or synthetic lease implementation stands in for those operations.
 * @evidence contracts/e2e.md#shared-execution One authored root, one seed script and one contender script serve recovery, two stale observations and delayed finalization. Three workers replace the previous six workers across three independent roots; no compiler, plugin producer or consumer installation runs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Ready/start/successor/finalizer barriers impose the exact order while retained generations keep their original fences. Finally opens every gate and awaits both contenders before TestProject cleanup; scripts and built API paths remain unchanged across phases.
 * @evidence contracts/e2e.md#preserved-coverage Seed success and exact abandoned fence, two ready fences, one reclaim/holder, live successor identity, failed old finalization, normal successor release, released state and retired seed/A/B tombstones execute here after removing the three duplicate entries. Their six worker lifetimes become this seed and two contenders; generation identities and barriers retain each recovery and finalizer distinction.
 */
export async function test_dependency_lock_corpus_preserves_dead_owner_and_successor_fencing(): Promise<void> {
  const root = TestProject.createProject(
    FixtureFiles.read("ttsc/dependency-lock-corpus"),
  );
  const lock = path.join(root, "entry.lock");
  const env = {
    LOCK_ROOT: root,
    LOCK_API: path.dirname(
      dependencyCacheLibraryPath("acquireDependencyBuildLock"),
    ),
  };
  const read = (name: string) =>
    JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  const open = (name: string) =>
    fs.writeFileSync(path.join(root, name), "open\n");
  const wait = (name: string) =>
    waitForCondition(() => fs.existsSync(path.join(root, name)), name);
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const seedResult = await spawnNodeWorker({
    script: path.join(root, "seed.cjs"),
    env,
  });
  assert.equal(seedResult.status, 0, seedResult.stderr);
  const seed = read("seed.json") as { generation: string };
  check("dead seed", () => {
    const observation = inspectDependencyBuildLock(lock, Date.now());
    assert.equal(observation.state, "abandoned");
    assert.deepEqual(
      observation.state === "abandoned" ? observation.fence : null,
      seed,
    );
  });
  const workers = ["a", "b"].map((role) =>
    spawnNodeWorker({
      script: path.join(root, "contender.cjs"),
      env: { ...env, LOCK_ROLE: role },
    }),
  );
  try {
    await Promise.all([wait("a-ready.json"), wait("b-ready.json")]);
    for (const role of ["a", "b"])
      check(role + " ready fence", () =>
        assert.deepEqual(read(role + "-ready.json"), seed),
      );
    open("a-start");
    await wait("a-lease.json");
    const old = read("a-lease.json") as { generation: string };
    open("b-start");
    await wait("b-observed.json");
    check("one stale winner", () => {
      assert.deepEqual(read("a-observed.json"), {
        reclaimed: true,
        holding: true,
      });
      assert.deepEqual(read("b-observed.json"), {
        reclaimed: false,
        holding: false,
      });
      assert.equal(fs.existsSync(path.join(root, "b-lease.json")), false);
      const active = inspectDependencyBuildLock(lock, Date.now());
      assert.equal(active.state, "active");
      assert.deepEqual(active.state === "active" ? active.fence : null, old);
      assert.equal(
        fs.existsSync(path.join(lock, "retired", seed.generation)),
        true,
      );
    });
    assert.equal(reclaimDependencyBuildLock(lock, old), true);
    open("b-successor");
    await wait("b-lease.json");
    const successor = read("b-lease.json") as { generation: string };
    open("a-finalize");
    await wait("a-result.json");
    check("late old finalizer", () => {
      assert.deepEqual(read("a-result.json"), { released: false });
      const active = inspectDependencyBuildLock(lock, Date.now());
      assert.equal(active.state, "active");
      assert.deepEqual(
        active.state === "active" ? active.fence : null,
        successor,
      );
    });
    open("b-finalize");
    const results = await Promise.all(workers);
    for (const [index, result] of results.entries())
      check("worker " + index, () =>
        assert.equal(result.status, 0, result.stderr),
      );
    check("normal successor release", () => {
      assert.deepEqual(read("b-result.json"), { released: true });
      assert.deepEqual(inspectDependencyBuildLock(lock, Date.now()), {
        state: "released",
      });
      assert.equal(reclaimDependencyBuildLock(lock, seed), false);
      assert.equal(releaseDependencyBuildLock(lock, old), false);
      for (const lease of [seed, old, successor])
        assert.equal(
          fs.existsSync(path.join(lock, "retired", lease.generation)),
          true,
        );
    });
  } finally {
    for (const gate of [
      "a-start",
      "b-start",
      "b-successor",
      "a-finalize",
      "b-finalize",
    ])
      open(gate);
    await Promise.allSettled(workers);
  }
  if (failures.length)
    throw new AggregateError(failures, "dependency lock corpus failed");
}
