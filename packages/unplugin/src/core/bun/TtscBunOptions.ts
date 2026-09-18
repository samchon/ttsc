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
 */
export type TtscBunOptions =
  | TtscUnpluginOptions
  | (() => TtscUnpluginOptions | undefined);
