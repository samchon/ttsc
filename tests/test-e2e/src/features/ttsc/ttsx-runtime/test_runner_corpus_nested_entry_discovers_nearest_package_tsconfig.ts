import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies runner corpus: nested entry discovers nearest package tsconfig.
 *
 * In a monorepo the entry file may live several levels below the workspace
 * root. ttsx must walk up from the entry file and use the nearest
 * `tsconfig.json` it finds, not a root-level one, so each package is compiled
 * with its own configuration.
 *
 * 1. Create a workspace with a tsconfig only under `packages/app/`.
 * 2. Run ttsx from the workspace root with an entry path of
 *    `packages/app/src/main.ts`.
 * 3. Assert compilation succeeds using the package-local tsconfig.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual launcher starts from workspace cwd but executes packages/app/src/main.ts under the package-local configuration, requiring status zero and nested-tsconfig-ok.
 * @evidence contracts/testing.md#independent-expectations The authored marker defines output independently; the supplied nested config provides the owning project. The current fixture has no competing root config, so it proves nested discovery rather than nearest-config precedence against a contrary root.
 * @evidence contracts/testing.md#distinguishing-cases A cwd above the owning tsconfig differs from ordinary same-root entry discovery; direct project locator units separately own nearest-config and competing-owner decisions.
 * @evidence contracts/testing.md#execution-ownership This named E2E export owns one actual public CLI/compiler/Node connection to a nested entry; its fixture source is not a hidden test entry.
 * @evidence contracts/e2e.md#necessary-boundary Discovered package ownership must reach the compiler and executable entry from ancestor cwd; direct locator results do not certify this caller connection.
 * @evidence contracts/e2e.md#shared-execution One immutable nested package uses one host and installed compiler preparation. The standalone consumer preparation remains a batching candidate rather than being claimed globally minimal.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity No configuration or source changes during the synchronous invocation; the tracked workspace is released by TestProject after test-process exit.
 * @evidence contracts/e2e.md#preserved-coverage The original status-zero and exact nested-tsconfig-ok assertions remain; no untested competing-config distinction is inferred from the test name.
 */
export function test_runner_corpus_nested_entry_discovers_nearest_package_tsconfig() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/runner_corpus_nested_entry_discovers_nearest_package_tsconfig/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "packages/app/src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "nested-tsconfig-ok");
  }
