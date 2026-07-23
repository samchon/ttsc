import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/index.js";

/**
 * Verifies cancellation wins at the public install error handoff.
 *
 * An archive stage can reject just before its caller resumes. If the active
 * solve is cancelled in that gap, returning the older stage error hides why the
 * install was superseded and can publish the wrong state transition.
 *
 * 1. Resolve one package to a controlled successful tarball response.
 * 2. Queue cancellation while response-header access throws a stage error.
 * 3. Assert the install rejects with the exact signal reason.
 */
export const test_npm_registry_prioritizes_abort_at_the_install_error_handoff =
  async () => {
    const controller = new AbortController();
    const reason = new DOMException("fixture aborted", "AbortError");
    const tarball = "https://tar.invalid/fixture.tgz";

    const installing = installPlaygroundDependencies(["fixture"], {
      signal: controller.signal,
      fetch: async (url) => {
        if (url.startsWith("https://registry.npmjs.org/")) {
          return Response.json({
            name: "fixture",
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: "fixture",
                version: "1.0.0",
                dist: { tarball },
              },
            },
          });
        }
        return {
          body: null,
          headers: {
            get() {
              queueMicrotask(() => controller.abort(reason));
              throw new Error("fixture response header failure");
            },
          },
          ok: true,
          status: 200,
        } as unknown as Response;
      },
    });

    await assert.rejects(installing, (error) => error === reason);
  };
