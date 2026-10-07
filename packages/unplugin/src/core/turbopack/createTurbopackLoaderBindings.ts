import type { TtscTurbopackLoaderContext } from "./TtscTurbopackLoaderContext";
import type { TtscTurbopackLoaderOptions } from "./TtscTurbopackLoaderOptions";

/**
 * Bind a delivery's optional host channels without reading its rule options
 * yet.
 *
 * Dependency, cacheability and error methods are captured with their original
 * context. Rule options are read through that context when the caller reaches
 * its original option-read boundary; normalization remains caller-owned.
 * Missing channels stay absent, and volatility forwards exactly false.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Bound methods retain the delivery's actual receiver and method identity;
 *   deferred option reading invokes the current getOptions with that receiver.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One binding record separates optional host capabilities from compilation,
 *   project registration and option normalization.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Uses the supplied public loader methods without replacing them, adding
 *   capabilities or fabricating options and compiler results.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains capture timing, absent capabilities and the separate
 *   option-read boundary, following the documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Treats callback arguments and options as opaque; path resolution and native
 *   dependency/watch policy remain with the loader and transform owners.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three optional binds and fixed callbacks allocate per delivery. Option
 *   getters and host callback work are delegated and can have additional cost;
 *   no option population is scanned or copied here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Context binding is delivery-specific; no completed transform or normalized
 *   option result is memoized or shared across deliveries.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The returned callbacks retain the context and selected methods while their
 *   caller keeps them. No watcher, timer or native handle is acquired here.
 */
export function createTurbopackLoaderBindings(
  context: Pick<
    TtscTurbopackLoaderContext,
    "addDependency" | "cacheable" | "emitError" | "getOptions"
  >,
) {
  const addDependency = context.addDependency?.bind(context);
  const cacheable = context.cacheable?.bind(context);
  const emitError = context.emitError?.bind(context);
  return {
    addDependency,
    emitError,
    markVolatile: cacheable === undefined ? undefined : () => cacheable(false),
    readOptions(): TtscTurbopackLoaderOptions {
      return context.getOptions?.() ?? {};
    },
  };
}
