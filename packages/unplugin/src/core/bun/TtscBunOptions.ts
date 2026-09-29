import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * Options accepted by `bun`, either resolved eagerly or supplied through a
 * provider evaluated lazily on the first `onLoad` call.
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
 */
export type TtscBunOptions =
  | TtscUnpluginOptions
  | (() => TtscUnpluginOptions | undefined);
