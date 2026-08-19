import assert from "node:assert/strict";
import os from "node:os";
import { resolveCapabilityPlugins } from "ttsc";

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
 */
export const test_resolvecapabilityplugins_answers_only_declared_capabilities =
  (): void => {
    const nowhere = resolveCapabilityPlugins({
      capability: "graphNodes",
      cwd: os.tmpdir(),
      tsconfig: "tsconfig.json",
    });
    assert.deepEqual(
      nowhere,
      [],
      "a directory that is not a project has to answer empty, not throw",
    );

    const undeclared = resolveCapabilityPlugins({
      capability: "aCapabilityNoPluginDeclares",
      cwd: os.tmpdir(),
      tsconfig: "tsconfig.json",
    });
    assert.deepEqual(
      undeclared,
      [],
      "a capability nothing declares has to answer empty; a fallback would be a guess",
    );
  };
