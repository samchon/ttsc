/**
 * Name the first recorded environment read that no longer has its recorded
 * value, or stays unset, in `environment`; `undefined` when every read holds.
 *
 * Native plugins record each variable they read through `ctx.Env` in the
 * envelope's `environmentInputs`, which generations, publications and project
 * records carry. Output is reusable only under an environment that would make
 * every such read return what it returned, so callers compare against the
 * compiler environment snapshot (`resolveCompilerEnvironment`) a recompile
 * would run under. A cache key cannot carry these names: only the compile
 * discovers them. An absent record, from an exception or from plugins that read
 * no variable, always holds.
 *
 * @evidence contracts/common.md#principled-implementation Equality of each recorded value or absence with the supplied snapshot is exactly the condition under which the plugin's reads would repeat; unrecorded variables are not inputs and are ignored.
 * @evidence contracts/common.md#clear-and-simple-design One predicate over the recorded map serves cached delivery, capture admission, shared-store adoption and persistent project records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No variable list, prefix or consumer name is special-cased; the recorded names alone decide what is compared.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the returned name, the comparison environment, why a key cannot replace this proof and the empty case.
 * @evidence contracts/portability.md#os-neutral-implementation Windows variable names compare case-insensitively against the snapshot, choosing the lexically first spelling as ttsc's sidecar environment does; other platforms compare names exactly.
 * @evidence contracts/performance.md#efficient-algorithms One lookup per recorded name; on Windows each lookup scans the snapshot's names, O(recorded × environment) with both small.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate decides reuse for its caller and retains no verdict.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Entry and Windows key arrays are call-local; no environment, verdict or native handle is retained.
 */
export function environmentInputMismatch(
  recorded: Readonly<Record<string, string | null>> | undefined,
  environment: NodeJS.ProcessEnv,
): string | undefined {
  for (const [name, value] of Object.entries(recorded ?? {})) {
    let current: string | undefined;
    if (process.platform === "win32") {
      const identity = name.toUpperCase();
      let selected: string | undefined;
      for (const key of Object.keys(environment))
        if (
          key.toUpperCase() === identity &&
          (selected === undefined || key < selected)
        )
          selected = key;
      current = selected === undefined ? undefined : environment[selected];
    } else if (Object.hasOwn(environment, name)) current = environment[name];
    if ((current ?? null) !== value) return name;
  }
  return undefined;
}
