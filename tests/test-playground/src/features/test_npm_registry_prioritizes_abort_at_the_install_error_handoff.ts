import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/src/npm/installPlaygroundDependencies";

/**
 * Verifies cancellation wins at the public install error handoff.
 *
 * An archive stage can reject just before its caller resumes. If the active
 * solve is cancelled in that gap, returning the older stage error hides why the
 * install was superseded and can publish the wrong state transition.
 *
 * 1. Control metadata JSON rejection and a successful tarball response.
 * 2. Queue cancellation across each stage-error handoff in turn.
 * 3. Assert both installs reject with their exact signal reason.
 * @evidence contracts/testing.md#behavioral-verification installPlaygroundDependencies must reject with the caller AbortError identity when cancellation arrives across metadata-JSON rejection or tarball-header failure handoff.
 * @evidence contracts/testing.md#independent-expectations Two independently authored DOMException instances are compared by identity; controlled microtask gates create the handoff without deriving an expected wrapper error from installation output.
 * @evidence contracts/testing.md#distinguishing-cases Metadata rejection and successful-response/header throwing paths exercise distinct catch boundaries, and exact signal reason prevents either older stage error from replacing cancellation.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its controlled JSON promise, response-header double and AbortControllers; it directly calls the installer with injected fetch and launches no network or product process.
 */
export const test_npm_registry_prioritizes_abort_at_the_install_error_handoff =
  async () => {
    const metadataController = new AbortController();
    const metadataReason = new DOMException(
      "metadata fixture aborted",
      "AbortError",
    );
    let rejectMetadata!: (error: Error) => void;
    const metadataJson = new Promise<unknown>((_resolve, reject) => {
      rejectMetadata = reject;
    });
    let metadataJsonStarted!: () => void;
    const metadataStarted = new Promise<void>((resolve) => {
      metadataJsonStarted = resolve;
    });
    const metadataResponse = new Response(null);
    Object.defineProperty(metadataResponse, "json", {
      value: () => {
        metadataJsonStarted();
        return metadataJson;
      },
    });
    const metadataInstalling = installPlaygroundDependencies(
      ["metadata-fixture"],
      {
        signal: metadataController.signal,
        fetch: async () => metadataResponse,
      },
    );
    await metadataStarted;
    void metadataJson.catch(() => {
      queueMicrotask(() => metadataController.abort(metadataReason));
    });
    rejectMetadata(new Error("metadata JSON failed"));
    await assert.rejects(
      metadataInstalling,
      (error) => error === metadataReason,
    );

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
