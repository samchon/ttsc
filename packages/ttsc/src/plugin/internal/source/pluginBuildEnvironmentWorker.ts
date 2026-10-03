import { parentPort } from "node:worker_threads";

import { serializeCompilerError } from "../../../internal/serializeCompilerError";
import { pluginBuildEnvironment } from "./pluginBuildEnvironment";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";

/**
 * Observe one requested native toolchain environment on the exclusive worker.
 * Explicit environment values reach every Go/toolchain reader; no caller
 * process globals are written. Only actual readings and pre-read witnesses
 * cross the worker boundary, and failures retain their real error details.
 */
parentPort?.on("message", (request: { directory: string; env: NodeJS.ProcessEnv }) => {
  try {
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    parentPort!.postMessage({
      environment: pluginBuildEnvironment(request.directory, request.env, witness),
      witness,
    });
  } catch (error) {
    parentPort!.postMessage({ thrown: serializeCompilerError(error) });
  }
});
