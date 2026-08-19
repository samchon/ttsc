import assert from "node:assert/strict";
import path from "node:path";

import {
  collectServeWatchRegistrations,
  createLinkedWorkspaceFixture,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: a watching server still receives existing watch inputs.
 *
 * The serve-side split in `core/index.ts` classifies by existence, not by
 * provenance: only inputs that are absent from disk bypass
 * `this.addWatchFile()`. An input that exists, the tsconfig chain above all,
 * keeps the ordinary registration, which Vite's import analysis records as an
 * import edge of the module and which preserves invalidation for type-only and
 * config inputs. This is the positive half of the watcher gate; the sibling
 * case pins the negative half.
 *
 * 1. Resolve the adapter against a serve config whose server has a watcher.
 * 2. Transform the fixture's entry module through the adapter's own hook.
 * 3. Assert the project tsconfig is among the registered watch inputs.
 */
export const test_vite_serve_registers_existing_watch_inputs_when_the_server_watches =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const watched = await collectServeWatchRegistrations(fixture, {
      watching: true,
    });
    const tsconfig = path.join(fixture.app, "tsconfig.json");
    assert.ok(
      watched.some((file) => path.resolve(file) === tsconfig),
      `a watching server must receive the tsconfig registration; watched: ${watched.join(", ")}`,
    );
  };
