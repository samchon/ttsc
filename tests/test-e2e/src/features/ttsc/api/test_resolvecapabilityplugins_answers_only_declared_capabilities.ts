import assert from "node:assert/strict";
import { TestProject } from "../../../../../utils/src/TestProject";
import { resolveCapabilityPlugins } from "ttsc";

/**
 * Verifies the capability seam answers by declaration, and answers empty rather
 * than throwing.
 *
 * Both requests use the same private directory without a tsconfig. Therefore
 * they establish only missing-project empty results for two capability names;
 * they do not independently distinguish declared versus undeclared capabilities
 * in a valid project or prove malformed-descriptor handling.

 * The existing built resolver prepares runtime capability authority before
 * project admission. This entry retains that real call path and its shared-cache
 * cost rather than adding a test-only production API.

 * 1. Ask a directory that is not a TypeScript project.
 * 2. Ask it again for a capability nothing declares.
 * 3. Assert both are empty arrays and neither threw.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveCapabilityPlugins in a nonproject temporary directory for graphNodes and an undeclared capability; requires two exact empty arrays and no throw.
 * @evidence contracts/testing.md#independent-expectations The capability API treats a missing project as no declaring plugins, so empty arrays are the independent expected result; a package fallback would invent an answer.
 * @evidence contracts/testing.md#distinguishing-cases Both queried capabilities share the nonproject state. Positive declaration discovery and malformed descriptor handling are not established here despite the broad earlier prose.
 * @evidence contracts/testing.md#execution-ownership This named feature calls the supported built CommonJS ttsc export, preserving actual runtime-capability preparation before missing-config admission. It does not reinterpret authored CommonJS internals as ESM or add a product seam to avoid that preparation.
 *
 * @evidence contracts/e2e.md#necessary-boundary The resolver currently probes descriptor-runtime capabilities even for missing projects. These negative semantics do not themselves need that preparation; pure ownership requires separating admission from runtime authority before transferring the case.
 * @evidence contracts/e2e.md#shared-execution Both queries share the private missing-project fixture and existing runtime cache. A prior stable capability result can avoid spawning, so a first call here is not proof of a cold runtime probe. Actual attempts and cache outcomes are separate observations; no plugin build or installation is authored by this entry.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the private directory and the missing tsconfig is the selected premise. Runtime/module/cache state may be shared; synchronous direct return is not arbitrary descendant shutdown or loaded-image identity. This entry does not clear shared caches to manufacture a cold path.
 * @evidence contracts/e2e.md#preserved-coverage Both original exact empty-array/no-throw assertions and capability literals remain through the existing built public export. They do not prove declaration filtering for a valid project, malformed config or positive plugin transport; those require their exact separate owners. Pure admission transfer remains unresolved without changing production merely for this test.
 */
export const test_resolvecapabilityplugins_answers_only_declared_capabilities =
  (): void => {
    const root = TestProject.tmpdir("ttsc-capability-no-project-");
    const nowhere = resolveCapabilityPlugins({
      capability: "graphNodes",
      cwd: root,
      tsconfig: "tsconfig.json",
    });
    assert.deepEqual(
      nowhere,
      [],
      "a directory that is not a project has to answer empty, not throw",
    );

    const undeclared = resolveCapabilityPlugins({
      capability: "aCapabilityNoPluginDeclares",
      cwd: root,
      tsconfig: "tsconfig.json",
    });
    assert.deepEqual(
      undeclared,
      [],
      "a capability nothing declares has to answer empty; a fallback would be a guess",
    );
  };
