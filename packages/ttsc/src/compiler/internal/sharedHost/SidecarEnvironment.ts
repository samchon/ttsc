/**
 * Native environment-name identity for child and isolated-worker environments.
 * Construction and Windows scans use own enumerable string names; they do not
 * reproduce Node's inclusion of inherited enumerable environment entries.
 *
 * Merge establishes layer precedence; read and write use that same identity for
 * invocation-owned channels. Replace lets an isolated worker adopt a complete
 * request snapshot without inheriting stale names from its preceding request.
 *
 * @evidence contracts/common.md#principled-implementation The namespace groups child-environment operations under one native name policy, so precedence and channel presence cannot disagree about Windows aliases.
 * @evidence contracts/common.md#clear-and-simple-design Construction, observation, channel mutation and complete replacement share one native name policy; the single public identity avoids separate environment policies in sidecar consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Members use supplied-object operations without replacing process.env or child-process APIs; a worker explicitly owns the mutable process.env target it adopts.
 * @evidence contracts/common.md#meaningful-documentation The namespace explains its plain-object boundary and each member documents precedence, undefined and native alias behavior according to the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Each member uses Windows case-insensitive name identity only on Windows; POSIX spelling remains exact throughout merge, lookup and removal.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups declarations; the member functions own and describe the actual environment scans and temporary indexes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace holds no coordinator or cached request result; supplied environments remain mutable and member calls observe current data.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no environment objects, native resources or historical entries between calls.
 */
export namespace SidecarEnvironment {
  /**
   * Replace an owned environment with a complete native-name snapshot.
   *
   * Worker process.env is case-sensitive even on Windows. Canonicalizing the
   * snapshot restores native name identity before existing SDK readers run.
   * Missing and undefined-valued entries are removed, including stale aliases;
   * POSIX retains distinct spellings. The caller must own the mutable target.
   *
   * @evidence contracts/common.md#principled-implementation Merge selects each native name's authoritative value before target mutation; clearing old own names then assigning defined values makes sequential worker requests independent of prior spelling or presence.
   * @evidence contracts/common.md#clear-and-simple-design The worker delegates complete environment adoption to the same namespace that owns native merge and lookup instead of duplicating Windows alias rules.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the caller-owned target is mutated through supported environment property operations; no foreign method or global environment object is replaced.
   * @evidence contracts/common.md#meaningful-documentation The comment states worker case behavior, full replacement, undefined removal and target ownership with descriptive prose separated from acknowledgments.
   * @evidence contracts/portability.md#os-neutral-implementation Windows native names are canonicalized through merge while POSIX spellings remain independent; deletion precedes assignment so case-sensitive worker copies cannot retain an old alias.
   * @evidence contracts/performance.md#efficient-algorithms Merge scans the incoming E names once; target deletion and defined-value assignment visit T and E names respectively, with temporary snapshot storage proportional to distinct incoming names. No per-name nested scan or sorting is added.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each snapshot is mutable invocation authority and must be applied anew; previous requests cannot authorize its environment.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller retains its target, while the normalized temporary snapshot ends with this synchronous call; no history or native resource is acquired.
   */
  export function replace(
    target: NodeJS.ProcessEnv,
    snapshot: NodeJS.ProcessEnv,
  ): void {
    const selected = merge(snapshot);
    for (const key of Object.keys(target)) delete target[key];
    for (const [key, value] of Object.entries(selected))
      if (value !== undefined) target[key] = value;
  }

  /**
   * Merge plain environment layers in precedence order, preserving native
   * names.
   *
   * Windows names are case-insensitive. Within one layer the lexicographically
   * first own spelling wins, matching Node spawn's duplicate selection for this
   * own-entry boundary; later layers override earlier layers independently of
   * spelling. POSIX names remain case-sensitive.
   *
   * @evidence contracts/common.md#principled-implementation Layer order expresses caller authority; Windows folds name identity while selecting each layer's lexicographically first spelling, matching Node's duplicate-name rule without allowing an inherited alias to defeat an override.
   * @evidence contracts/common.md#clear-and-simple-design One environment merge owns native name identity for every sidecar constructor; callers supply distinct default, caller and resolved-value layers instead of embedding precedence in object spreads.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported plain-object operations prepare an explicit child environment without replacing process.env or the spawning API.
   * @evidence contracts/common.md#meaningful-documentation Purpose and precedence paragraphs define Windows duplicate handling and POSIX spelling preservation following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Windows case-insensitive environment identity is isolated here; POSIX keys retain exact spelling, and the returned object contains no ambiguous Windows aliases.
   * @evidence contracts/performance.md#efficient-algorithms E entries across supplied layers require name enumeration/copying plus uppercase and comparison text costs on Windows. A per-layer map selects minimum spellings without sorting; its distinct names coexist with Object.keys arrays and the accumulated returned environment. Plain-object property reads remain part of the supplied-data boundary.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Environment layers can change between child runs and the result is independently mutable; this operation owns no equivalent-request coordinator or stable invalidation identity.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Temporary name indexes end with the call, and the merged object transfers to its caller; no historical environment, handle or task is retained.
   */
  export function merge(
    ...layers: readonly (NodeJS.ProcessEnv | undefined)[]
  ): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = Object.create(null);
    for (const layer of layers) {
      if (layer === undefined) continue;
      if (process.platform !== "win32") {
        Object.assign(result, layer);
        continue;
      }
      const names = new Map<string, string>();
      for (const key of Object.keys(layer)) {
        const identity = key.toUpperCase();
        const previous = names.get(identity);
        if (previous === undefined || key < previous) names.set(identity, key);
      }
      for (const [identity, key] of names) result[identity] = layer[key];
    }
    return result;
  }

  /**
   * Read a plain child-environment name using the host's native identity rule.
   * Undefined includes an absent layer or a selected undefined-valued
   * spelling.
   *
   * @evidence contracts/common.md#principled-implementation Exact lookup serves POSIX names; the minimum matching spelling serves Windows aliases using the same selection Node applies to plain spawn environments.
   * @evidence contracts/common.md#clear-and-simple-design One accessor supplies channel-presence decisions without duplicating Windows alias handling in every cleanup helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The accessor inspects supplied data rather than modifying a global environment or guessing an expected channel value.
   * @evidence contracts/common.md#meaningful-documentation The comment states native name semantics and the meaning of undefined, separated from tags according to the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Case folding occurs only for Windows environment identity; POSIX variables with different case remain distinct.
   * @evidence contracts/performance.md#efficient-algorithms POSIX performs one supplied-object property lookup, including its name/data access costs. Windows allocates an Object.keys array and scans E own names with uppercase/comparison text costs to select the minimum spelling, without a full sort or historical index.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller owns a mutable environment, so previous reads have no stable validity identity or coordinated reuse boundary.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This synchronous accessor retains no environment history, descriptor or task.
   */
  export function read(
    env: NodeJS.ProcessEnv | undefined,
    name: string,
  ): string | undefined {
    if (env === undefined) return undefined;
    if (process.platform !== "win32") return env[name];
    const identity = name.toUpperCase();
    let selected: string | undefined;
    for (const key of Object.keys(env)) {
      if (
        key.toUpperCase() === identity &&
        (selected === undefined || key < selected)
      ) {
        selected = key;
      }
    }
    return selected === undefined ? undefined : env[selected];
  }

  /**
   * Set or remove an invocation-owned channel on a plain child environment.
   * Removing a Windows name also removes every differently cased alias.
   *
   * @evidence contracts/common.md#principled-implementation All spellings of a Windows channel share one native identity; removing aliases before a write or deletion establishes one authoritative value, while POSIX changes only the requested exact name.
   * @evidence contracts/common.md#clear-and-simple-design One write boundary owns channel replacement and removal, avoiding partial deletion rules scattered through sidecar constructors.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation mutates only the explicitly supplied child environment; it neither replaces foreign methods nor changes process.env.
   * @evidence contracts/common.md#meaningful-documentation The native comment explains undefined-driven removal and Windows alias cleanup following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native environment identity determines the deletion set; Windows emits one uppercase spelling and POSIX preserves exact names.
   * @evidence contracts/performance.md#efficient-algorithms Windows deletion allocates an Object.keys array and visits E names with uppercase/text and property-deletion costs; POSIX deletes one supplied key directly. The optional value assignment remains caller-data work; neither branch sorts names or launches a child.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Channel writes are invocation effects on mutable caller data and cannot be replaced by a previous result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The mutated environment remains caller-owned; this helper retains no additional state or native resources.
   */
  export function write(
    env: NodeJS.ProcessEnv,
    name: string,
    value: string | undefined,
  ): void {
    const identity = process.platform === "win32" ? name.toUpperCase() : name;
    if (process.platform === "win32") {
      for (const key of Object.keys(env)) {
        if (key.toUpperCase() === identity) delete env[key];
      }
    } else {
      delete env[name];
    }
    if (value !== undefined) env[identity] = value;
  }
}
