import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EvidenceProcessOwnership } from "./EvidenceProcessOwnership";
import { assertExcludes, assertFailure, assertIncludes, assertStatus, runCheck, type IRunResult, type ITtscEvidenceProject } from "./index";

/**
 * Authored watch mutations and assertions consumed by one positive watcher.
 *
 * @evidence contracts/common.md#principled-implementation Literal authored document/model/operation mutations drive actual native cycles, and the canonical cold check observes identical physical inputs; assertion callbacks never generate expected findings from parser output.
 * @evidence contracts/common.md#clear-and-simple-design Named callbacks own Markdown, cold, Swagger, ancestor, code-link, staged and cache transitions; the batch supplies only process, path, write, settle and assertion collection operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing modules are revoked only from an actual detached library, and PID/count come from actual native output; no synthetic result or forced compiler/cache policy supplies a verdict.
 * @evidence contracts/common.md#meaningful-documentation Each callback records its original assertion ownership, independent literal oracle, shared preparation, reset and limitation; telemetry equality applies only inside the Markdown phase, not across config reloads.
 * @evidence contracts/performance.md#efficient-algorithms Mutation and assertion work is linear in the finite authored input and observed diagnostic lists; exact sorted cold comparison retains duplicate findings rather than deduplicating them.
 * @evidence contracts/performance.md#reuse-equivalent-work Alpha callbacks share verified identical source/document inputs and one phase Program; both cache controls share one private library and unrelated rebuild, while cold retains one independently loaded Program.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Callbacks retain only current results and own no separate watcher or fixture; the batch requests launcher closure before guarded cleanup and preserves errors. Direct source and private-loader deletion also refuse unknown reader ownership. Normal Node exit is not independently native sidecar join proof; that lifetime remains delegated to the launcher.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins locate owned local, genuinely external and detached-library files; text expectations use authored portable addresses and shared helpers own actual Node/compiler processes.
 */
export namespace positiveWatchCases {
  /**
   * The batch-owned actual fixture, roots, results and cycle operations for one phase.
   *
   * @evidence contracts/common.md#principled-implementation Actual owned paths and captured verdicts connect authored mutations to the original independent assertions; the batch owns guarded writes and process lifetime.
   * @evidence contracts/common.md#clear-and-simple-design One readonly context carries the phase inputs and observation operations without allocating another consumer or watcher.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Requested status or text never supplies the observed result; loader deletion targets only the verified private copy and unresolved-reader admission remains explicit.
   * @evidence contracts/common.md#meaningful-documentation Fields distinguish local and external physical roots, actual baseline, guarded mutation, settled observation and collected assertions.
   */
  export interface Context {
    /** Canonical primary project used unchanged by the original cold check. */
    readonly project: ITtscEvidenceProject;

    /** Physical root containing this phase's authored local source and documents. */
    readonly localRoot: string;

    /** Owned physical ancestor root containing external inputs absent from the Program. */
    readonly outsideRoot: string;

    /** Actual detached private Evidence library, the only permitted loader-deletion target. */
    readonly library: string;

    /** Activation result, independently checked for its authored status0 or2; assertions collect independently. */
    readonly baseline: IRunResult;

    /** Writes and records exact originals for bounded later recovery. */
    readonly write: (relative: string, bytes: string, outside?: boolean) => void;

    /** Removes one exact owned input while retaining its original bytes or absence for recovery. */
    readonly remove: (relative: string, outside?: boolean) => void;

    /** Observes the latest settled real cycle; requested status/text do not replace its result. */
    readonly next: (status: number, marker?: string) => Promise<IRunResult>;

    /** Requires a finite real no-build observation and rejects a terminated watcher. */
    readonly quiet: (milliseconds: number) => Promise<unknown>;

    /** Records independent assertion failures so unrelated cases still execute. */
    readonly check: (assertion: () => void) => void;
  }

  /** Original covered heading bytes shared by all three Alpha watch cases. */
  export const alpha = "## Alpha\n";

  /** Authors the original PostgreSQL datasource and one UUID-id model per name. */
  export const schema = (names: readonly string[]): string => ["datasource db {", '  provider = "postgresql"', "}", "", ...names.flatMap(name => [`model ${name} {`, "  id String @id @db.Uuid", "}", ""])].join("\n");

  /** Authors original member operations; sibling contracts retain Created/201 responses. */
  export const swagger = (methods: readonly string[], operation = "/members", external = false): string => JSON.stringify({ openapi: "3.1.0", info: { title: "Members", version: "1.0.0" }, paths: { [operation]: Object.fromEntries(methods.map(method => [method, { responses: external ? { "201": { description: "Created" } } : { "200": { description: "OK" } } }])) } }, null, 2) + "\n";

  /**
   * Verifies an exact Swagger dependency arrives after initially missing startup.
   *
   * Registering only existing files would leave the first failing build unable
   * to observe the generator's first creation of the parent and document.
   *
   * 1. Start the shared watcher before api/swagger.json or its parent exists.
   * 2. Require the original absent-input status2 without inventing its diagnostic.
   * 3. Create the original POST document and require the real rebuild status0.
   *
   * @evidence contracts/testing.md#behavioral-verification The actual initial absent Swagger build must fail2, then creating its parent and exact POST document must trigger a passing0 build.
   * @evidence contracts/testing.md#independent-expectations The literal POST:/members citation and authored OpenAPI POST operation establish the recovered graph independently; no initial diagnostic text is required.
   * @evidence contracts/testing.md#distinguishing-cases Startup before the exact file and parent exist contrasts with generated valid bytes; the batch additionally restores absence before changing the source/config population.
   * @evidence contracts/testing.md#execution-ownership generatedSwagger is invoked first by test_evidence_positive_watch_consumers_share_one_watcher; the batch owns the actual child, guarded file creation and independent verdict assertions.
   * @evidence contracts/e2e.md#necessary-boundary Missing-path registration and packaged Swagger normalization must connect an actual first file creation to a native resident rebuild.
   * @evidence contracts/e2e.md#shared-execution This first phase shares the canonical producer, workspace and launcher with later phases while preserving genuinely missing startup; later config/source populations legitimately retire and reload Programs.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity It precedes every api-writing phase; the guarded writer records initial absence, creates the owned parent and restores absence before another phase. Unknown reader ownership blocks mutation and cleanup.
   * @evidence contracts/e2e.md#preserved-coverage Both original status2 and generated0 assertions from test_evidence_watch_observes_a_generated_swagger_document remain here with identical source/citation, JSON bytes and real cycle timeout.
   */
  export async function generatedSwagger(context: Context): Promise<void> {
    context.check(() => assert.ok(!fs.existsSync(path.join(context.localRoot, "api")), "The original generated Swagger parent must be absent at startup."));
    context.check(() => assertStatus(context.baseline, 2, "A citation against a document that does not exist cannot resolve and must be reported."));
    context.write("api/swagger.json", swagger(["post"]));
    const generated = await context.next(0);
    context.check(() => assertStatus(generated, 0, "Generating the declared document must be observed even though it was missing when the watch started."));
  }

  /**
   * Verifies an initially empty Markdown glob observes creation and deletion.
   *
   * A declared population must remain watched while no Markdown file matches;
   * updating only the startup file inventory would miss its first obligation.
   *
   * 1. Activate the original empty docs/.keep population and require status2.
   * 2. Create Alpha and require its obligation with the empty finding absent.
   * 3. Delete Alpha and require the empty finding with its obligation absent.
   *
   * @evidence contracts/testing.md#behavioral-verification The real empty-glob baseline reports2 and matched no markdown files; creation introduces missing Alpha and removes empty, while deletion restores empty and removes Alpha.
   * @evidence contracts/testing.md#independent-expectations The original recursive docs Markdown glob, empty .keep and literal Alpha heading independently determine the three inventory states.
   * @evidence contracts/testing.md#distinguishing-cases Empty, created and deleted populations are distinct real events; post-create/delete status is requested for logging but the original assertions concern diagnostic content only.
   * @evidence contracts/testing.md#execution-ownership markdownLife runs through the shared positive features entry after a genuine source/config reinitialization; the batch owns exact-file writes/removal and collects each content assertion independently.
   * @evidence contracts/e2e.md#necessary-boundary A native contributor's declared glob watcher must discover a new file and withdraw its deleted heading from the resident inventory.
   * @evidence contracts/e2e.md#shared-execution One existing launcher serves all three states after the original source/config population activates; no cold compiler, build or consumer is allocated for either filesystem event.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The authored document does not exist at activation and only its owned exact path changes between settled cycles. Removal restores original absence before Alpha's distinct cited source population activates.
   * @evidence contracts/e2e.md#preserved-coverage Original initial2 and all five empty/Alpha inclusions or exclusions from test_evidence_watch_observes_markdown_create_and_delete remain with identical .keep/source/heading bytes; no later status assertion is claimed.
   */
  export async function markdownLife(context: Context): Promise<void> {
    context.check(() => assertStatus(context.baseline, 2, "A reference glob matching no document cannot materialize evidence and must be reported."));
    context.check(() => assertIncludes(context.baseline, "matched no markdown files", "The empty population must name the globs that produced it."));
    context.write("docs/spec.md", alpha);
    const created = await context.next(2);
    context.check(() => assertIncludes(created, "Missing acknowledgement for 'docs/spec.md#alpha'", "A created document must be observed even though nothing matched the glob when the watch started."));
    context.check(() => assertExcludes(created, "matched no markdown files", "The population must stop being empty once the document exists."));
    context.remove("docs/spec.md");
    const deleted = await context.next(2);
    context.check(() => assertIncludes(deleted, "matched no markdown files", "Deleting the only matched document must empty the population again."));
    context.check(() => assertExcludes(deleted, "Missing acknowledgement for 'docs/spec.md#alpha'", "A deleted heading must not survive as an obligation in the next cycle."));
  }

  /**
   * Verifies declared Markdown freshness, unrelated quiet and stable resident identity.
   *
   * The original warm and declared-input cases have byte-identical Alpha sources.
   * One rename can prove both telemetry residency and fresh graph inventory.
   *
   * 1. Verify the original Alpha document bytes and observe an unrelated README edit.
   * 2. Rename Alpha to Beta and check failure, old/new findings and resident telemetry.
   * 3. Restore Alpha and require recovery before another phase.
   *
   * @evidence contracts/testing.md#behavioral-verification Real watch ignores README for 1500ms, reports status 2 with unresolved alpha and missing beta, preserves actual resident PID and cumulative Program loads, then recovers to 0.
   * @evidence contracts/testing.md#independent-expectations Authored Alpha/Beta headings and literal addresses establish inventory expectations; before/after PID and load equality independently observe retained identity rather than a timing threshold.
   * @evidence contracts/testing.md#distinguishing-cases Declared mutation and recovery contrast with undeclared quiet; initial telemetry must exist and both PID/count are compared. Quiet proves only the original finite 1500ms window.
   * @evidence contracts/testing.md#execution-ownership The original warm-Program and declared-Markdown assertions run through test_evidence_positive_watch_consumers_share_one_watcher in features; the batch owns its real native watcher and collects each assertion failure.
   * @evidence contracts/e2e.md#necessary-boundary Contributor input declarations must connect external Markdown events to native refreshed findings without replacing its unchanged phase Program.
   * @evidence contracts/e2e.md#shared-execution Original declared-Markdown and warm-Program cases share one byte-verified Alpha source/document, one watcher and one rename/recovery rather than repeated producers or initial loads.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every mutation follows a settled real cycle; the README is outside declared document globs and the document returns to Alpha before another phase. The batch closes the watcher before fixture cleanup.
   * @evidence contracts/e2e.md#preserved-coverage Both original baseline verdicts share actual baseline0; all original quiet, status2, alpha/beta findings, recovery0, PID and count assertions execute here.
   */
  export async function markdown(context: Context): Promise<void> {
    verifyAlpha(context);
    context.write("README.md", "# Fixture\n\nUnrelated prose.\n");
    await context.quiet(1_500);
    context.write("docs/spec.md", "## Beta\n");
    const renamed = await context.next(2, "Unresolved evidence target 'docs/spec.md#alpha'");
    context.check(() => assertStatus(renamed, 2, "The actual Markdown rebuild must fail."));
    context.check(() => assertIncludes(renamed, "Unresolved evidence target 'docs/spec.md#alpha'", "The old heading must become stale."));
    context.check(() => assertIncludes(renamed, "Missing acknowledgement for 'docs/spec.md#beta'", "Beta must become the current obligation."));
    const before = telemetry(context.baseline), after = telemetry(renamed);
    context.check(() => assert.notEqual(before, null, "Initial native resident telemetry must exist."));
    context.check(() => assert.ok(before !== null && after !== null && before.pid === after.pid && before.loads === after.loads, `Markdown-only changes must retain PID/count: ${JSON.stringify({ before, after })}\n\nBaseline:\n${context.baseline.output}\n\nRefreshed:\n${renamed.output}`));
    context.write("docs/spec.md", alpha);
    const restored = await context.next(0);
    context.check(() => assertStatus(restored, 0, "The restored Alpha document must recover from its event alone."));
  }

  /**
   * Verifies warm findings agree with a fresh compiler on the same physical inputs.
   *
   * The second process is an actual cold Program, even when its native artifact is cached.
   *
   * 1. Add an uncited Delta sibling without changing compiler sources.
   * 2. Run the canonical workspace producer's real check in the same directory.
   * 3. Compare status2 and nonempty five-category findings with exact multiplicity.
   *
   * @evidence contracts/testing.md#behavioral-verification Actual warm and cold checks of Delta must both return 2 and have equal extracted diagnostic text and multiplicity, with nonempty findings and bidirectional containment.
   * @evidence contracts/testing.md#independent-expectations The fresh invocation supplies a differential state oracle on identical bytes and paths; it shares product implementation, so literal authored Delta independently requires failure.
   * @evidence contracts/testing.md#distinguishing-cases Initial success becomes missing-sibling failure. Extraction retains the original five opening categories and does not claim equality for unrelated diagnostics.
   * @evidence contracts/testing.md#execution-ownership The original cold-equivalence assertions execute through the named positive features batch; runCheck retains the original actual canonical workspace producer exception without editing a live package junction.
   * @evidence contracts/e2e.md#necessary-boundary Native resident state must agree with a newly loaded compiler Program; direct parser calls cannot expose stale process-retained inventory.
   * @evidence contracts/e2e.md#shared-execution One shared watcher supplies warm output and one required fresh check supplies the cold oracle; both use the same unchanged actual producer and content-addressed native cache.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Delta bytes remain unchanged for both observations in the same physical fixture. The synchronous cold child completes before Alpha reset and all process joins precede cleanup.
   * @evidence contracts/e2e.md#preserved-coverage Original initial0, warm2, cold2, nonempty extraction, exact sorted multiplicity and both containment loops remain here; the batch adds bounded Alpha reset0.
   */
  export async function cold(context: Context): Promise<void> {
    verifyAlpha(context);
    context.write("docs/spec.md", "## Alpha\n\n## Delta\n");
    const warm = await context.next(2, "Missing acknowledgement for 'docs/spec.md#delta'");
    const fresh = runCheck(context.project.directory);
    context.check(() => assertStatus(fresh, 2, "The actual fresh compiler must fail Delta."));
    context.check(() => assertStatus(warm, 2, "The actual warm compiler must fail Delta."));
    const left = diagnostics(fresh), right = diagnostics(warm);
    context.check(() => assert.deepEqual([...left].sort(), [...right].sort(), "Warm/cold findings must retain exact multiplicity."));
    context.check(() => assert.notEqual(left.length, 0, "The comparison must not be vacuous."));
    for (const item of left) context.check(() => assertIncludes(warm, item, "Cold findings must appear warm."));
    for (const item of right) context.check(() => assertIncludes(fresh, item, "Warm findings must appear cold."));
  }

  /**
   * Verifies an exact local Swagger input widens and recovers through resident watch.
   *
   * 1. Add GET beside the cited POST.
   * 2. Require the literal missing GET finding and status2.
   * 3. Remove GET and require status0 with no missing acknowledgement.
   *
   * @evidence contracts/testing.md#behavioral-verification POST baseline0 becomes GET missing status2 and returns to0 without Missing acknowledgement after GET withdrawal.
   * @evidence contracts/testing.md#independent-expectations Literal POST/GET methods and GET:/members target derive from authored OpenAPI input, not the normalizer.
   * @evidence contracts/testing.md#distinguishing-cases Complete, widened incomplete and restored complete distinguish refresh in both directions with no TypeScript edit.
   * @evidence contracts/testing.md#execution-ownership The positive features batch invokes this callback against its real native watch session and original exact-file channel.
   * @evidence contracts/e2e.md#necessary-boundary Exact-file watch registration, packaged Node normalization and resident contributor findings must agree on changed operation bytes.
   * @evidence contracts/e2e.md#shared-execution One watcher serves POST baseline, widening and recovery. This phase stays separate from final cache controls because Swagger memo keys are content-only and process-lifetime: parsing GET here would otherwise prewarm that later case's original miss-control bytes. A genuine config reload releases native processes before cache preparation.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each authored JSON write follows a settled cycle and POST bytes are restored before loader revocation; batch finally owns process/fixture release.
   * @evidence contracts/e2e.md#preserved-coverage Original initial0, widened2, GET finding, restored0 and restored missing-text absence remain here.
   */
  export async function swaggerRefresh(context: Context): Promise<void> {
    context.write("api/swagger.json", swagger(["post", "get"]));
    const widened = await context.next(2, "Missing acknowledgement for 'GET:/members'");
    context.check(() => assertStatus(widened, 2, "GET must fail the actual rebuild."));
    context.check(() => assertIncludes(widened, "Missing acknowledgement for 'GET:/members'", "The changed document must renormalize."));
    context.write("api/swagger.json", swagger(["post"]));
    const restored = await context.next(0);
    context.check(() => assertStatus(restored, 0, "Withdrawn GET must recover."));
    context.check(() => assertExcludes(restored, "Missing acknowledgement", "Withdrawn operations must not remain cached."));
  }

  /**
   * Verifies both declared ancestor channels refresh beyond compiler source membership.
   *
   * 1. Rename and restore the rooted sibling Markdown heading.
   * 2. Change and restore the ascending Swagger operation path.
   * 3. Require original stale targets and clean recoveries.
   *
   * @evidence contracts/testing.md#behavioral-verification External discounts/refunds and members/customers edits each fail status2 with their original stale targets, then restore to0 from external events alone.
   * @evidence contracts/testing.md#independent-expectations Literal explicit anchors and POST paths prescribe unresolved requirements/pricing.md#discounts and POST:/members.
   * @evidence contracts/testing.md#distinguishing-cases Rooted Markdown glob and ancestor-relative exact Swagger file are distinct channels with separate invalidation/recovery; TypeScript sources stay fixed.
   * @evidence contracts/testing.md#execution-ownership The positive batch invokes this callback in its resident process; both targets are physical workspace siblings outside the project directory.
   * @evidence contracts/e2e.md#necessary-boundary Actual contributor registration must lift the project-root ceiling for glob and exact-file watchers, rather than rely on compiler source watch.
   * @evidence contracts/e2e.md#shared-execution Both ancestor inputs use one existing host and parser preparations; four event cycles retain the original two-channel batch.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only owned sibling bytes change, in sequence after settled observations, and both originals return before subsequent phases. No foreign directory is mutated.
   * @evidence contracts/e2e.md#preserved-coverage Original initial0 and both invalid2/stale-target/recovery0 sequences survive; new-target names remain outside the original oracle.
   */
  export async function outside(context: Context): Promise<void> {
    context.write("docs/requirements/pricing.md", "## Refund Policy {#refunds}\n", true);
    const renamed = await context.next(2, "Unresolved evidence target 'requirements/pricing.md#discounts'");
    context.check(() => assertStatus(renamed, 2, "Ancestor Markdown must invalidate."));
    context.check(() => assertIncludes(renamed, "Unresolved evidence target 'requirements/pricing.md#discounts'", "The original sibling anchor must become stale."));
    context.write("docs/requirements/pricing.md", "## Discount Policy {#discounts}\n", true);
    const restoredDocument = await context.next(0);
    context.check(() => assertStatus(restoredDocument, 0, "Restoring outside Markdown must recover."));
    context.write("contracts/swagger.json", swagger(["post"], "/customers", true), true);
    const changed = await context.next(2, "Unresolved evidence target 'POST:/members'");
    context.check(() => assertStatus(changed, 2, "Ancestor Swagger must invalidate."));
    context.check(() => assertIncludes(changed, "Unresolved evidence target 'POST:/members'", "The old outside operation must be stale."));
    context.write("contracts/swagger.json", swagger(["post"], "/members", true), true);
    const restored = await context.next(0);
    context.check(() => assertStatus(restored, 0, "Restoring outside Swagger must recover."));
  }

  /**
   * Verifies an external code-link export rename, deletion and restoration refresh.
   *
   * 1. Rename value in the original physical sibling source.
   * 2. Delete that file and require the distinct file diagnostic.
   * 3. Restore value with numeric bytes2 and require recovery.
   *
   * @evidence contracts/testing.md#behavioral-verification Actual watch fails an external export rename with Missing TypeScript evidence export, fails deletion with Missing TypeScript evidence file, then recovers when value2 returns.
   * @evidence contracts/testing.md#independent-expectations Authored file/member names and original diagnostic categories distinguish missing symbol from missing source; restored value2 is independently valid.
   * @evidence contracts/testing.md#distinguishing-cases The target is outside the compiler Program; rename and delete are separate failures and restoring different numeric bytes succeeds without a compiler source edit.
   * @evidence contracts/testing.md#execution-ownership The named positive features batch calls this case with one actual resident watcher and its owned physical external source.
   * @evidence contracts/e2e.md#necessary-boundary Contributor external-code input topology must carry filesystem changes into Markdown link validation outside compiler source membership.
   * @evidence contracts/e2e.md#shared-execution Four original states share the existing baseline and three actual event cycles rather than separate compiler preparations.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the owned api/example.ts sibling changes; deletion is exact and restoration occurs after observing its failed cycle. Batch reset returns original value1 before other cases.
   * @evidence contracts/e2e.md#preserved-coverage Original baseline0, both failure predicates/categories and changed-numeric restoration0 execute here without relying on a unit resolver's name.
   */
  export async function codeLink(context: Context): Promise<void> {
    context.write("api/example.ts", "export const renamed = 1;\n", true);
    const renamed = await context.next(2, "Missing TypeScript evidence export");
    context.check(() => assertFailure(renamed, "Renamed external export must fail."));
    context.check(() => assertIncludes(renamed, "Missing TypeScript evidence export", "The rename must invalidate the link."));
    EvidenceProcessOwnership.assertAvailable(context.project.directory);
    fs.unlinkSync(path.join(context.outsideRoot, "api/example.ts"));
    const deleted = await context.next(2, "Missing TypeScript evidence file");
    context.check(() => assertFailure(deleted, "Deleted external file must fail."));
    context.check(() => assertIncludes(deleted, "Missing TypeScript evidence file", "The deletion must be observed."));
    context.write("api/example.ts", "export const value = 2;\n", true);
    const restored = await context.next(0);
    context.check(() => assertStatus(restored, 0, "Changed numeric bytes with restored export must recover."));
  }

  /**
   * Verifies the first Staged claim preserves its identity when enabled.
   *
   * 1. Observe disabled initial0 with no missing-docs loading.
   * 2. Enable the same first group through a real config rewrite.
   * 3. Require Claim1 Staged and the missing population path.
   *
   * @evidence contracts/testing.md#behavioral-verification Disabled first claim is absent from initial missing-docs output; enabling it fails with Claim 1 ('Staged') and missing-docs while the satisfied Live sibling remains present.
   * @evidence contracts/testing.md#independent-expectations Original Staged name, first numeric position and missing-docs glob independently prescribe its transport identity; the enabled control prevents a silent rule substitute.
   * @evidence contracts/testing.md#distinguishing-cases Disabled versus enabled configurations differ only in the original boolean, beside a satisfied enabled sibling. Initial success alone does not certify that sibling activation.
   * @evidence contracts/testing.md#execution-ownership The original Staged assertions change the primary lint.config.ts through this positive features batch and consume a settled actual native watch verdict.
   * @evidence contracts/e2e.md#necessary-boundary Typed disabled state, config reload and native serialized graph options must preserve claim position/name through transport.
   * @evidence contracts/e2e.md#shared-execution Staged/Live use the existing watcher and canonical producer, while their actual configuration activation and enable/reset events may reload the Program; no Program reuse is claimed across those config changes.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The batch checks one exact authored disabled marker before replacing it and restores the complete original config after the phase; no package or native source identity changes.
   * @evidence contracts/e2e.md#preserved-coverage Original disabled status0/path absence, enabled failure, exact Claim1 name and missing path survive; reset0 is added between consumers.
   */
  export async function staged(context: Context): Promise<void> {
    context.check(() => assertExcludes(context.baseline, "missing-docs", "The disabled population must not load."));
    const original = fs.readFileSync(path.join(context.localRoot, "lint.config.ts"), "utf8");
    const marker = "disabled: true";
    assert.equal(original.split(marker).length - 1, 1, "Exactly the original first Staged marker must change.");
    context.write("lint.config.ts", original.replace(marker, "disabled: false"));
    const enabled = await context.next(2, "Claim 1 ('Staged')");
    context.check(() => assertFailure(enabled, "Enabled incomplete claim must fail."));
    context.check(() => assertIncludes(enabled, "Claim 1 ('Staged')", "Original position/name must survive."));
    context.check(() => assertIncludes(enabled, "missing-docs", "Enabled population must load."));
  }

  /**
   * Verifies both equal-byte parser caches with private loader revocation last.
   *
   * 1. Remove both actual loaders from the previously detached private SDK copy.
   * 2. Make one unrelated TypeScript edit and require both cached inputs remain green.
   * 3. Change Prisma, restore its original bytes, then change Swagger and require each distinct loader failure.
   *
   * @evidence contracts/testing.md#behavioral-verification Both absent packaged loaders permit an unchanged-input TypeScript rebuild0; changed Prisma fails2 with Prisma schema loader, exact original Prisma reset returns0, then changed Swagger fails2 with Swagger normalizer.
   * @evidence contracts/testing.md#independent-expectations Physical deletion of the private real loader modules makes a parse miss unusable. Changed-input failures independently validate the revocation control and original-byte recovery checks digest reuse.
   * @evidence contracts/testing.md#distinguishing-cases The original Prisma and Swagger cases share a compatible Sale/members/unrelated Program with exact independent src/sale.ts and src/members.ts selectors; both caches are populated at baseline; one unrelated edit tests equal bytes, and distinct changed sources test invalidation. Irreversible loader revocation runs last so it cannot determine preceding freshness outcomes.
   * @evidence contracts/testing.md#execution-ownership The positive features batch executes this last callback through the real resident contributor and its private packaged Node loader copy.
   * @evidence contracts/e2e.md#necessary-boundary Actual native cache hits must avoid packaged Node/WASM calls, while changed bytes must use those real loaders; direct digest units cannot prove process avoidance.
   * @evidence contracts/e2e.md#shared-execution Original Prisma and Swagger cache cases share baseline parser preparation, one private SDK copy, one watcher and one unrelated rebuild after both loader deletions; each changed-input failure remains separate.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity privatizeLibrary verified/unlinked the fixture junction before copying, and only that owned copy is damaged. Original source bytes separate the two miss controls; final watcher join precedes fixture removal and all failures propagate.
   * @evidence contracts/e2e.md#preserved-coverage Both original initial0 and unchanged0 verdicts share actual equivalent cycles; changed2 and exact Prisma/Swagger categories remain separate, with an added original-Prisma reset0 before Swagger.
   */
  export async function caches(context: Context): Promise<void> {
    EvidenceProcessOwnership.assertAvailable(context.project.directory);
    for (const name of ["loadPrismaModels.js", "loadSwaggerOperations.js"]) fs.rmSync(path.join(context.library, "internal", name));
    context.write("src/unrelated.ts", "export const version = 2;\n");
    const reused = await context.next(0);
    context.check(() => assertStatus(reused, 0, "Both unchanged inputs must reuse memory without loaders."));
    context.write("prisma/schema.prisma", schema(["Sale", "Seller"]));
    const changedSchema = await context.next(2, "Prisma schema loader");
    context.check(() => assertStatus(changedSchema, 2, "Changed schema must miss cache."));
    context.check(() => assertIncludes(changedSchema, "Prisma schema loader", "Actual removed Prisma loader must be needed."));
    context.write("prisma/schema.prisma", schema(["Sale"]));
    const restored = await context.next(0);
    context.check(() => assertStatus(restored, 0, "Original schema bytes must remain cached after the failed miss."));
    context.write("api/swagger.json", swagger(["post", "get"]));
    const changedSwagger = await context.next(2, "Swagger normalizer");
    context.check(() => assertStatus(changedSwagger, 2, "Changed Swagger must miss cache."));
    context.check(() => assertIncludes(changedSwagger, "Swagger normalizer", "Actual removed Swagger loader must be needed."));
  }
}

/** Verifies actual shared fixture bytes before either original Alpha mutation. */
function verifyAlpha(context: positiveWatchCases.Context): void {
  context.check(() => assert.equal(fs.readFileSync(path.join(context.localRoot, "docs/spec.md"), "utf8"), positiveWatchCases.alpha));
  context.check(() => assert.equal(fs.readFileSync(path.join(context.localRoot, "src/implementation.ts"), "utf8"), "/** @evidence docs/spec.md#alpha Implements the current specification section. */\nexport interface Implementation {}\n"));
}

function telemetry(result: IRunResult): { pid: number; loads: number } | null {
  const match = result.output.match(/@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+)/);
  return match === null ? null : { pid: Number(match[1]), loads: Number(match[2]) };
}

function diagnostics(result: IRunResult): string[] {
  return result.output.split(/\r?\n/).map(line => {
    const match = line.match(/(Missing|Unresolved|Duplicate|Ambiguous|Out-of-scope) /);
    return match?.index === undefined ? "" : line.slice(match.index).trim();
  }).filter(line => line.length !== 0);
}
