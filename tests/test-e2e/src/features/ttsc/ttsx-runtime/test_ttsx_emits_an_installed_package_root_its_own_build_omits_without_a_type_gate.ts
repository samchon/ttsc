import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies ttsx compiles an installed package's file that the package's own
 * project omits through that project's options, without a type gate.
 *
 * The negative twin of the checked-root case. A file no build covered is
 * compiled alone through its owning `tsconfig.json`, and whether that build is
 * type-checked follows who wrote the file. Code under `node_modules` belongs to
 * someone else: every other file of the package is served from an emit-only
 * build, and a type error that only its own configuration reports must not stop
 * the consumer's program. The legacy decorator's argument count pins that the
 * package's options still applied: `experimentalDecorators` passes three
 * arguments to a method decorator, where standard decorators pass two.
 *
 * 1. Install a package whose tsconfig sets `experimentalDecorators` and `include:
 *    ["src"]`, while its `main` is `index.ts` outside `src`.
 * 2. Give `index.ts` a type error and a legacy method decorator.
 * 3. Run a consumer entry that requires the package.
 * 4. Assert the program runs and observes the legacy decorator's three arguments.
 *
 * @evidence contracts/testing.md#behavioral-verification Ttsx requires installed legacy-pkg/index.ts excluded by its package include, carrying a type error and a legacy decorator; it must succeed with arguments=3.
 * @evidence contracts/testing.md#independent-expectations The dependency emit-only contract permits its own string-to-number diagnostic, while legacy decorator arity independently identifies inherited experimentalDecorators.
 * @evidence contracts/testing.md#distinguishing-cases The installed excluded root differs from a checked own-source root and must retain package options without a type gate. This entry does not set noEmitOnError; its adjacent sibling does.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Actual package resolution and native fallback emit must execute erroneous dependency source with the proper decorator lowering. Direct policy units cannot prove that exact compiler/runtime connection.
 * @evidence contracts/e2e.md#shared-execution One immutable consumer/package fixture uses one host and dependency/excluded-root preparations. The adjacent noEmitOnError test repeats a similar graph with one option difference and remains a consolidation candidate until exact assertions transfer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only private installed fixture sources execute; no source changes mid-run. TestProject owns the graph and synchronous exit ends its host/runtime generation owners.
 * @evidence contracts/e2e.md#preserved-coverage Original successful exit and decorator arity remain. Dependency diagnostic tolerance and inherited options are both witnessed; no package-directory or cache-state assertion is implied.
 */
export function test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate/inputs-1",
    ),
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "arguments=3");
}
