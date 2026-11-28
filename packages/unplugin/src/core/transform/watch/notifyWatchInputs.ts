import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "../envelope/TtscEnvelopeDerivation";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { deriveWatchInputsFromIndexes } from "../envelope/deriveWatchInputsFromIndexes";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../envelope/envelopeGraphIndexes";
import { hostSpelling } from "../envelope/hostSpelling";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { selectWatchInputs } from "../envelope/selectWatchInputs";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchSelection } from "./TtscWatchSelection";
import { evidencedWatchInput } from "./evidencedWatchInput";
import { generationWatchInputs } from "./generationWatchInputs";
import { handWatchInputs } from "./handWatchInputs";
import { notifyProjectRecord } from "./notifyProjectRecord";
import { projectMembershipInput } from "./projectMembershipInput";
import { selectionInputs } from "./selectionInputs";

/**
 * Hand the host what a successful delivery of `file` depends on.
 *
 * A host keyed on the module's own inputs (`addWatchFile`, `addWatchFiles`)
 * receives the inputs derived for `file`: the plugin-reported
 * `dependencies[file]` list unioned with the host-owned reference graph's
 * contribution (`reach(edges, file)`, `globals`, `configs`, and resolution
 * candidates), each with the evidence the generation recorded, plus the config
 * selection. Envelope keys mirror the `typescript` keys (project-relative);
 * values may be project-relative or absolute. Every path is absolutized against
 * the project root and deduplicated; the file itself is dropped (the host
 * already watches the module it transforms), and so is every path in the
 * disposed transform scratch tree (see
 * {@link TtscCachedProjectTransform.scratchDirectory}).
 *
 * A project hook receives the generation's record through notifyProjectRecord.
 * When both project and module hooks are present, both receive their respective
 * registrations; without module hooks, delivery stops after project handoff. A
 * serve hook can register the generation union once and use the exact module
 * dependency selection when an observed input changes. Routing and membership
 * remain per delivery.
 *
 * @evidence contracts/common.md#principled-implementation Module delivery derives the selected file's dependencies. Grouped importers match changed paths against those dependencies. The Vite owner reloads conservatively when a change list is unavailable or matching throws. Project delivery records the full generation and its routing configs. Membership remains opt-in.
 * @evidence contracts/common.md#clear-and-simple-design Both host models share one routing observation batch, with dependency selection, evidence mapping and record persistence delegated to their actual owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Generation derivation removes disposed scratch inputs. A refused project record requests volatility through a supplied markVolatile callback instead of inventing a record; host-owned cache withdrawal remains that callback's responsibility, not an effect fabricated by this orchestrator.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish module and project dependencies, scratch exclusion and routing, followed by separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Generation-owned identity and hostSpelling keep native physical identity separate from adapter spelling; routing observations use the delivery's filesystem capability.
 * @evidence contracts/performance.md#efficient-algorithms No consuming hooks short-circuit all work. Otherwise every routing occurrence is observed once for this delivery, then shared between record and module branches. A project branch delegates full generation/record costs; a module branch delegates selected closure/index/native identity work, maps fresh evidence carriers, copies/spells routed entries and performs final keyed handoff. Costs include bytes, key/path text, cold native observations, membership encoding and callback effects, with call-local arrays sized by these populations even when some underlying generation lists are memoized.
 * @evidence contracts/performance.md#reuse-equivalent-work Generation lists, identities and membership use their owners' qualified immutable/root/options/native-view memos. Routing evidence is observed once here and shared between current branches; actual callbacks still run for each delivery, and new routing spellings extend the record snapshot rather than being dropped because a generation is reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Live importers can retain their generation's routing metadata, graph indexes and path identities after eviction. Vite releases an importer on replacement, forgetting or disposal. Retention grows with live importers and the metadata of their generations, without a separate fixed cap. The compiler cache owns emitted output and validation state.
 */
export function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
  selection: TtscWatchSelection,
): void {
  if (
    hooks === undefined ||
    (hooks.project === undefined &&
      hooks.addWatchFile === undefined &&
      hooks.addWatchFiles === undefined)
  ) {
    return;
  }
  const state = envelopeDerivation(cached);
  const routedInputs = selectionInputs(
    [...new Set([...selection.consulted, selection.tsconfig])],
    selection.filesystem,
    (input) => input,
  );
  // A module handed over without its record depends on its own bytes alone,
  // so no persistent cache may keep it.
  if (
    hooks.project !== undefined &&
    // Common delivery already withdrew this host cache. Incomplete local
    // output cannot write a record, so avoid a second withdrawal callback.
    cached.freshDeliveryOnly !== true &&
    !notifyProjectRecord(
      hooks.project,
      cached,
      false,
      () => generationWatchInputs(cached),
      routedInputs,
    )
  ) {
    hooks.markVolatile?.();
  }
  if (hooks.addWatchFile === undefined && hooks.addWatchFiles === undefined) {
    return;
  }
  const spell = hostSpelling(state.project, file);
  const local: TtscWatchInput[] = [];
  const membership =
    hooks.membership === true ? projectMembershipInput(cached) : undefined;
  if (membership !== undefined) local.push(membership);
  for (const input of routedInputs)
    local.push({ ...input, file: spell(input.file) });
  // Across a linked root the delivered spelling can change the observation
  // path, so each importer keeps its own registration there.
  if (
    hooks.watchGeneration !== undefined &&
    cached.result.type === "success" &&
    cached.scratchDirectory !== undefined &&
    state.project.physical === state.project.spelling &&
    hooks.watchGeneration(
      cached.scratchDirectory,
      generationWatchInputs(cached),
      local,
      bindWatchMatcher(groupedWatchMatcher(cached, cached.result, state), file),
    )
  )
    return;

  const inputs: TtscWatchInput[] = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  }).map((input) => evidencedWatchInput(cached, state, input, spell));
  handWatchInputs(
    hooks,
    [...inputs, ...local],
    undefined,
    cached.result.type === "exception"
      ? undefined
      : cached.result.environmentInputs,
  );
}

type WatchMatcher = (file: string, changed: ReadonlySet<string>) => boolean;

const GROUPED_MATCHERS = new WeakMap<
  TtscCachedProjectTransform,
  WatchMatcher
>();

/**
 * Share a generation's routing inputs among Vite importers. Importers can keep
 * this matcher after eviction, so its closure takes no cached transform or
 * compiler result.
 */
function groupedWatchMatcher(
  cached: TtscCachedProjectTransform,
  result: Extract<TtscCachedProjectTransform["result"], { type: "success" }>,
  state: TtscEnvelopeDerivation,
): WatchMatcher {
  const prior = GROUPED_MATCHERS.get(cached);
  if (prior !== undefined) return prior;
  const { edges, spellings, candidates, globals, configs, resolutionInputs } =
    envelopeGraphIndexes(state, cached);
  const matcher = makeWatchMatcher(
    {
      identities: state.identities,
      identityContext: state.identityContext,
      selection: state.selection,
    },
    { edges, spellings, candidates, globals, configs, resolutionInputs },
    {
      projectRoot: cached.projectRoot,
      scratchDirectory: cached.scratchDirectory,
      temporaryTsconfig: cached.temporaryTsconfig,
    },
    {
      type: result.type,
      dependencies: result.dependencies,
      dependenciesComplete: result.dependenciesComplete,
      hostInputs: result.hostInputs,
      workspaceInputs: result.workspaceInputs,
      volatile: result.volatile,
    },
    [...selectPluginSourceInputs(result).keys()],
  );
  GROUPED_MATCHERS.set(cached, matcher);
  return matcher;
}

/**
 * Match a changed path against one importer's dependency selection using only
 * the routing data borrowed from its generation.
 */
function makeWatchMatcher(
  state: Parameters<typeof deriveWatchInputsFromIndexes>[0],
  graph: Parameters<typeof deriveWatchInputsFromIndexes>[1],
  options: Omit<Parameters<typeof deriveWatchInputsFromIndexes>[2], "file">,
  dependencies: Parameters<typeof deriveWatchInputsFromIndexes>[3],
  pluginSources: readonly string[],
): WatchMatcher {
  return (file, changed) =>
    deriveWatchInputsFromIndexes(
      state,
      graph,
      { ...options, file },
      dependencies,
      pluginSources,
      derivationIdentity(state, file),
    ).some((input) => changed.has(path.resolve(input)));
}

function bindWatchMatcher(
  match: WatchMatcher,
  file: string,
): (changed: ReadonlySet<string>) => boolean {
  return (changed) => match(file, changed);
}
