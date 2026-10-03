/**
 * The subset of the Metro Babel-transformer contract this adapter relies on.
 *
 * Metro loads the module named by `transformer.babelTransformerPath` and calls
 * its `transform` once per file, expecting a Babel AST back. `getCacheKey` is
 * an optional export Metro folds into its transform-cache key; Metro invokes it
 * with arguments (e.g. `{ projectRoot, enableBabelRCLookup }`), so it is typed
 * variadic.
 *
 * @evidence contracts/common.md#principled-implementation
 *   This structural interface describes Metro's Babel-transformer extension:
 *   one transform operation and an optional variadic cache key. It does not
 *   implement Babel, install peers or alter their exports. Concrete modules
 *   supply the callbacks through normal Node loading.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This peer-independent interface exposes only the transform and cache-key
 *   callbacks the adapter invokes, avoiding a dependency on Metro's full API.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains the awaited AST result and optional cache-key
 *   callback including forwarded arguments. Checked against the documentation
 *   skill: separate paragraphs state the contract and why its nonobvious
 *   boundary matters; field comments retain their own useful facts.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Declares a shape only; it holds no state, handle or buffer.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Declares a shape only; there is no loop or processing in it.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Declares a shape only; it computes nothing to share.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Describes the callbacks of a Babel transformer; it names no path or process.
 */
export interface UpstreamTransformer {
  /**
   * Parse the supplied source and return the Babel AST Metro consumes.
   *
   * The adapter preserves Metro's filename, options and additional parameters;
   * only `src` may hold successfully transformed TypeScript. The returned AST
   * may have its locations remapped by the adapter before Metro receives it.
   *
   * @evidence contracts/common.md#principled-implementation
   *   This method signature represents the upstream transformer that Metro
   *   selected.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   One parameter record preserves Metro's extensible delivery shape and
   *   the result exposes only the AST this adapter needs.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   It accepts the original Metro parameter record, with src replaced only by
   *   the owning adapter after a successful compiler pass; the type declares no
   *   implementation or test-specific branch.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The native JSDoc explains source, filename, extra Metro parameters and
   *   the awaited Babel AST result. Checked against the documentation skill:
   *   separate paragraphs state the contract and why its nonobvious boundary
   *   matters; field comments retain their own useful facts.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Declares a shape only; it holds no state, handle or buffer.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Declares a shape only; there is no loop or processing in it.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Declares a shape only; it computes nothing to share.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   The filename is Metro's own string, passed through to Babel unchanged.
   */
  transform(params: {
    src: string;
    filename: string;
    options: Record<string, unknown>;
    [key: string]: unknown;
  }): Promise<{ ast: object }>;

  /**
   * Optional upstream contribution to Metro's static transformer key.
   *
   * Metro's arguments are forwarded unchanged. Absence contributes no upstream
   * key; the adapter treats a throwing key as nonfatal and disables reuse,
   * while transformer loading failures still fail actual transformation.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The optional callback follows Metro's upstream transformer contract.
   *   Arguments are variadic because Metro supplies its own key options; absence
   *   is handled by the adapter.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   An optional variadic callback expresses the one upstream contribution
   *   without adapter-specific copies of Metro's cache-key options.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   This signature executes nothing and never replaces a foreign callback.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The native JSDoc explains optional absence, forwarded Metro arguments and
   *   the upstream key contribution. Checked against the documentation skill:
   *   separate paragraphs state the contract and why its nonobvious boundary
   *   matters; field comments retain their own useful facts.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Declares a shape only; it holds no state, handle or buffer.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Declares a shape only; there is no loop or processing in it.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Declares a shape only; it computes nothing to share.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Metro's arguments are forwarded unchanged; no path is interpreted here.
   */
  getCacheKey?: (...args: unknown[]) => string;
}
