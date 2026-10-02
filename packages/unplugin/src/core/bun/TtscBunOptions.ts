import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * Options accepted by `bun`, either resolved eagerly or supplied through a
 * provider evaluated lazily on the first included transformable `onLoad` call.
 *
 * The provider form exists for the runtime registration path (`bun-register`),
 * where a single Bun plugin is registered on import but its effective options
 * may be overridden by explicit `register(options)` calls made before the first
 * transformable TypeScript load. Resolving through the provider on that first
 * load, rather than at registration, lets the last pending call win without Bun
 * ever seeing a second shadowing loader.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The object/provider union preserves eager bundler options and the deferred
 *   runtime snapshot whose value is not fixed until the first load.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One provider variant serves pending registration without adding mutable
 *   controls to the common adapter options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Deferred evaluation implements the actual pre-load override contract,
 *   rather than installing a second loader that shadows the first.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the provider's evaluation time and why runtime registration
 *   needs it; separate paragraphs and tags follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   The value/provider choice specifies option acquisition timing, not native
 *   path interpretation or runtime capability. Option consumers own those boundaries.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The union selects no traversal; resolveOptions and the loader own option
 *   interpretation and transform work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The loader owns its resolved snapshot and first-load sharing. This provider
 *   signature supplies no independent cache identity or invalidation mechanism.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The installed loader/state owners retain provider and snapshot values;
 *   this union acquires no resource or historical state itself.
 */
export type TtscBunOptions =
  | TtscUnpluginOptions
  | (() => TtscUnpluginOptions | undefined);
