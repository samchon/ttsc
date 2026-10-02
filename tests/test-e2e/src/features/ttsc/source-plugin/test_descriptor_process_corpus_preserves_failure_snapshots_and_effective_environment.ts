import { TestProject } from "@ttsc/testing";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  fs,
  path,
  spawnNodeWorker,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies descriptor failures keep their environment, output and retry
 * authority.
 *
 * One plain Node caller invokes nine descriptors. The loader owns a fresh inner
 * evaluator for each request, so caller module-cache separation is unnecessary.
 * Failure messages are recorded separately from inherited child stderr: a stack
 * printed by the shim cannot satisfy the returned module-body reason
 * assertion.
 *
 * 1. Observe effective factory env, redirected logging and one-shot module writes.
 * 2. Refuse forged errors, rewritten errors, late files and directory candidates.
 * 3. Load extensionless ESM descriptors for context env and module-body failure.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual built loader evaluates nine authored descriptors from a plain Node caller. Seven exact one-line counters, empty caller stdout, forwarded stderr, absent forbidden fallback, contradictory env markers and the returned status-plus-reason distinguish duplicate evaluation, channel leakage and retry forgery.
 * @evidence contracts/testing.md#independent-expectations Authored literal errors, run-newline counters, absent trap marker and context-only versus ambient markers establish the expected outcomes. The body message comes from the caller's results file, independently of the shim stack on stderr.
 * @evidence contracts/testing.md#distinguishing-cases Factory and module failures, assigned extension and missing-module codes, a mutated genuine failure, a post-failure file and a directory at a candidate path remain separate evaluations. Extensionless ESM context and body cases preserve environment selection and the returned failure reason; these assertions do not count which runtime-loading route was selected.
 * @evidence contracts/testing.md#execution-ownership This named E2E scenario owns one plain Node worker invoking the built loader and its actual isolated and ttsx evaluators. Portable process-failure and envelope interpretation remain in their existing source units.
 * @evidence contracts/e2e.md#necessary-boundary Actual isolated evaluator transport must carry effective env, redirect arbitrary descriptor stdout, seal retry classification at failure time and return the ttsx body envelope. Running inside the unit loader cannot establish the plain Node fallback route.
 * @evidence contracts/e2e.md#shared-execution One authored project and one caller replace three roots and nine caller workers. Nine loader requests retain their actual isolated evaluator attempts and any ttsx fallback; those shims still own temporary projects and compiler work. No inner evaluator, compiler request or runtime-capability probe reduction is claimed. The negative trap is never a compiler substitute.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each descriptor has a distinct path and counter. The shared config is changed only after synchronous evaluation returns, failed evaluations do not publish reusable results, and effective env overrides stay call-local. TestProject releases the root only after the caller and its synchronous children exit.
 * @evidence contracts/e2e.md#preserved-coverage Seven original counter and retry cases plus context-env and returned module-body status-and-reason remain individually checked even if another case fails. These assertions replace the three removed entries; the separate descriptor runtime-input provenance matrix retains its own owner.
 */
export async function test_descriptor_process_corpus_preserves_failure_snapshots_and_effective_environment(): Promise<void> {
  const root = TestProject.createProject(
    FixtureFiles.read("ttsc/descriptor-process-corpus"),
  );
  const result = await spawnNodeWorker({
    script: path.join(root, "worker.cjs"),
    env: {
      DESCRIPTOR_API: path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "lib",
        "plugin",
        "internal",
        "load",
        "loadProjectPlugins.js",
      ),
      TTSC_BINARY: TestProject.NATIVE_BINARY,
      TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      TTSC_DESC_MARKER: "ambient",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const records: { name: string; failed: boolean; message: string }[] =
    JSON.parse(fs.readFileSync(path.join(root, "results.json"), "utf8"));
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  check("transport", () => {
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /DESCRIPTOR_STDOUT_MARKER loaded/);
    assert.equal(
      fs.existsSync(path.join(root, "forbidden-fallback.txt")),
      false,
    );
    assert.deepEqual(
      records.map((record) => record.name),
      [
        "factory",
        "module",
        "counterfeit",
        "counterfeit-missing",
        "mutated-missing",
        "late-candidate-race",
        "directory-candidate-race",
        "context",
        "body",
      ],
    );
  });
  const expected: [string, RegExp][] = [
    ["factory", /factory-env:effective/],
    ["module", /module-initialization:loaded/],
    ["counterfeit", /user-assigned loader code/],
    ["counterfeit-missing", /Cannot find module '\.\/phantom'/],
    ["mutated-missing", /Cannot find module '\.\/phantom'/],
    ["late-candidate-race", /Cannot find module '\.\/late-candidate'/],
    [
      "directory-candidate-race",
      /Cannot find module '\.\/directory-candidate'/,
    ],
    ["context", /absent-context-only/],
    ["body", /failed with exit code 1\ndescriptor-module-body-failed/],
  ];
  for (const [name, reason] of expected)
    check(name, () => {
      const record = records.find((entry) => entry.name === name);
      assert.equal(record?.failed, true);
      assert.match(record?.message ?? "", reason);
      if (name !== "context" && name !== "body")
        assert.equal(
          fs.readFileSync(path.join(root, name + "-runs.txt"), "utf8"),
          "run\n",
        );
    });
  check("environment and failure-time candidates", () => {
    assert.equal(
      /factory-env:ambient|absent-ambient/.test(result.stderr),
      false,
    );
    assert.equal(
      fs.readFileSync(path.join(root, "late-candidate.ts"), "utf8"),
      "export const value = 1;\n",
    );
    assert.equal(
      fs.statSync(path.join(root, "directory-candidate.ts")).isDirectory(),
      true,
    );
  });
  if (failures.length !== 0)
    throw new AggregateError(failures, "descriptor process corpus");
}
