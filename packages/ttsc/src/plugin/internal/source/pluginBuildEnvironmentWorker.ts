import { parentPort } from "node:worker_threads";

import { serializeCompilerError } from "../../../internal/serializeCompilerError";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "./PluginContentIdentities";
import { pluginBuildEnvironment } from "./pluginBuildEnvironment";

/**
 * Observe one requested native toolchain environment on the exclusive worker.
 * Explicit environment values reach every Go/toolchain reader; no caller
 * process globals are written. Only actual readings and pre-read witnesses
 * cross the worker boundary, and failures retain their real error details.
 * A request that names its project lets this isolate prove the SDK and the
 * executables from the plugin cache's records instead of their bytes (#1722).
 */
parentPort?.on(
  "message",
  (request: {
    directory: string;
    env: NodeJS.ProcessEnv;
    projectRoot?: string;
  }) => {
    try {
      const witness: PluginBuildEnvironmentWitness.Record = new Map();
      const identities =
        request.projectRoot === undefined
          ? undefined
          : PluginContentIdentities.open({
              projectRoot: request.projectRoot,
              env: request.env,
              sources: [request.directory],
            });
      parentPort!.postMessage({
        environment: pluginBuildEnvironment(
          request.directory,
          request.env,
          witness,
          identities,
        ),
        witness,
      });
    } catch (error) {
      parentPort!.postMessage({ thrown: serializeCompilerError(error) });
    }
  },
);
