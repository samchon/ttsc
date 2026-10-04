import path from "node:path";

/**
 * Project the single-root overlay that inherits the selected owning config.
 * Explicit empty include/exclude lists displace inherited populations. Checked
 * overlays preserve inherited noEmitOnError; unchecked overlays clear it.
 * The caller supplies the already selected physical volume root and owns
 * config placement, exclusive creation, parsing, compilation and cleanup.
 *
 * @evidence contracts/common.md#principled-implementation The overlay retains its owning config through extends, selects the exact source and clears inherited include/exclude populations without changing the checked lane's noEmitOnError policy.
 * @evidence contracts/common.md#clear-and-simple-design One fresh JSON-compatible object supplies the existing fixed compiler overrides and selected path values to the production writer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ordinary compiler config fields own selection; no compiler output, native root inference or read result is invented or intercepted.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph states list replacement, checked versus unchecked policy and the caller-owned filesystem/compiler boundaries.
 * @evidence contracts/portability.md#os-neutral-implementation Only the host-native separator is replaced with config-compatible slashes in the selected config, source and volume-root strings; this operation does not resolve paths or infer a filesystem root.
 * @evidence contracts/performance.md#efficient-algorithms Three replaceAll operations visit the supplied path text before constructing a fixed-size object and arrays; fixed property count does not bound input string bytes or delegated compilation cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This projection coordinates no completed or in-flight producer; build and cache reuse remain with its caller.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A fresh returned object transfers to the caller and no descriptor, process, history or retained cache is acquired.
 */
export function singleRootProjectConfig(props: {
  tsconfig: string;
  source: string;
  volumeRoot: string;
  checked: boolean;
}) {
  return {
    extends: props.tsconfig.replaceAll(path.sep, "/"),
    compilerOptions: {
      composite: false,
      declaration: false,
      declarationMap: false,
      ...(props.checked ? {} : { noEmitOnError: false }),
      rootDir: props.volumeRoot.replaceAll(path.sep, "/"),
    },
    files: [props.source.replaceAll(path.sep, "/")],
    include: [],
    exclude: [],
  };
}
