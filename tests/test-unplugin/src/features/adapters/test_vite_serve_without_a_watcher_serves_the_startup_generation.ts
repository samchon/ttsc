import { assertViteServeWithoutAWatcherServesTheStartupGeneration } from "../../internal/adapter-vite";

/**
 * Verifies a real watcherless dev server answers first use from its startup
 * generation.
 *
 * The lifecycle half of samchon/ttsc#1260, asserted through a running Vite
 * server rather than the adapter's hooks: `server.watch: null` leaves the
 * session no channel through which an edit could ever reach it, so the session
 * serves one coherent compilation instead of mixing pre-edit and post-edit
 * generations across the modules it delivers. This case replaces the pre-#1260
 * scenario that asserted the opposite verdict for the same configuration; the
 * invariant that one asserted — a dev server's single `buildStart` is no build
 * boundary — now belongs to the watching configuration it was always about, and
 * is pinned there.
 *
 * 1. Start Vite serve with no watcher and request the entry module, whose compile
 *    also produces the lazy module's output.
 * 2. Corrupt the entry on disk, so a fresh compile would fail.
 * 3. Request the never-served lazy module and assert it is answered from the
 *    startup generation.
 */
export const test_vite_serve_without_a_watcher_serves_the_startup_generation =
  async () => {
    await assertViteServeWithoutAWatcherServesTheStartupGeneration();
  };
