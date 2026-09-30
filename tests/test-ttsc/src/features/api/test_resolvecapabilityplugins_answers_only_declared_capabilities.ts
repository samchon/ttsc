import assert from "node:assert/strict";
import { TestProject } from "../../../../utils/src/TestProject";
import { resolveCapabilityPlugins } from "../../../../../packages/ttsc/src/plugin/resolveCapabilityPlugins";

/**
 * Verifies the capability seam answers by declaration, and answers empty rather
 * than throwing.
 *
 * This is the entry a tool outside the compiler uses to ask a plugin a question
 * the plugin declared it can answer — `@ttsc/graph` asks for `graphNodes` the
 * way `ttscserver` asks for `lsp`. Two properties make it usable at all, and
 * both are easy to lose.
 *
 * It answers by capability, never by package. A caller naming a package would
 * put contributor knowledge in the compiler host, which is exactly what the
 * seam exists to avoid, so a capability nothing declares has to come back empty
 * rather than falling back to something plausible.
 *
 * It never throws. A project with no plugins, a directory that is not a project
 * at all, and a project whose plugin configuration does not load are all
 * ordinary states for a consumer that is only trying to enrich an answer — and
 * the user already sees a real error for the third from the command that
 * compiles their code. Turning any of them into an exception makes a graph, an
 * editor, or a script fail for a reason that is not theirs.
 *
 * The positive path — a project whose plugin declares the capability, built and
 * returned — is covered end to end by the graph suite, which is where a real
 * declaring plugin already exists. Asking this repository's own root here would
 * build every plugin it configures to prove a filter, three minutes per run on
 * a cold cache.
 *
 * 1. Ask a directory that is not a TypeScript project.
 * 2. Ask it again for a capability nothing declares.
 * 3. Assert both are empty arrays and neither threw.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveCapabilityPlugins in a nonproject temporary directory for graphNodes and an undeclared capability; requires two exact empty arrays and no throw.
 * @evidence contracts/testing.md#independent-expectations The capability API treats a missing project as no declaring plugins, so empty arrays are the independent expected result; a package fallback would invent an answer.
 * @evidence contracts/testing.md#distinguishing-cases Both queried capabilities share the nonproject state. Positive declaration discovery and malformed descriptor handling are not established here despite the broad earlier prose.
 * @evidence contracts/testing.md#execution-ownership This named API feature calls the authored resolver, which probes the actual JavaScript runtime before missing-config admission; it remains in the boundary population rather than hiding that subprocess in units.
 *
 * @evidence contracts/e2e.md#necessary-boundary The resolver currently probes descriptor-runtime capabilities even for missing projects. These negative semantics do not themselves need that preparation; pure ownership requires separating admission from runtime authority before transferring the case.
 * @evidence contracts/e2e.md#shared-execution Both capability queries share a private nonproject fixture and the runtime capability cache can reuse a stable Node executable. No plugin build or per-query installation is performed, but the first runtime probe remains a real process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject allocates a private empty directory instead of ambient os.tmpdir, preserving the missing-config premise. The synchronous runtime probe owns its child and registered fixture cleanup belongs to suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Both original exact empty-array assertions remain. They do not cover declaring plugins or malformed config; graph/native positive survivors own real plugin transport, and the unnecessary runtime preparation is an unresolved transfer cost.
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
