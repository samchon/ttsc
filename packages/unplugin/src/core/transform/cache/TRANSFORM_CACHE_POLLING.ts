import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * The caches whose host watches by polling, as Vite does under
 * `server.watch.usePolling` (samchon/ttsc#1395).
 *
 * A host that polls has said its filesystem's native notifications cannot be
 * trusted, so a generation in such a cache never accepts watcher silence as
 * proof. It validates every delivery against its recorded state instead.
 */
export const TRANSFORM_CACHE_POLLING = new WeakSet<TtscTransformCache>();
