import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a program plugin can declare completeness too.
 *
 * `@ttsc/strip` removes statements matching configured patterns and reads
 * nothing else, so it declares from `ApplyProgram`. Paired with the banner
 * case, this pins both hooks the host counts as contributors.
 *
 * 1. Create a project whose only plugin is `@ttsc/strip`.
 * 2. Collect the entry module's watch inputs.
 * 3. Assert the type-only sibling is absent while `tsconfig.json` and
 *    `strip.config.json` are present.
 *
 * @evidence contracts/testing.md#behavioral-verification Real strip entry watch inputs omit type-only sibling but retain tsconfig and strip.config.
 * @evidence contracts/testing.md#independent-expectations Strip reads no sibling; literal config paths prevent falsely passing an empty watch set.
 * @evidence contracts/testing.md#distinguishing-cases Program-hook completeness versus banner source-hook twin; required universal configs survive narrowing.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_strip_narrows_the_entry_watch_inputs is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for program-hook completeness versus banner source-hook twin; required universal configs survive narrowing. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Real strip entry watch inputs omit type-only sibling but retain tsconfig and strip.config. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_strip_narrows_the_entry_watch_inputs(): Promise<void> {
  const project = createLinkedPluginProject(["strip"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `a strip-only project must not register the entry's type-only sibling; watched: ${watched.join(", ")}`,
  );
  // The same two assertions the banner case makes: a list that collapsed to
  // nothing would also drop the sibling, and would be a far worse bug.
  assert.ok(
    watched.includes(path.resolve(path.join(project.root, "tsconfig.json"))),
    "the config chain stays universal for a file declared complete",
  );
  assert.ok(
    watched.includes(
      path.resolve(path.join(project.root, "strip.config.json")),
    ),
    "the plugin's own config remains a universal host input",
  );
}
