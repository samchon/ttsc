import { ROOT_FILES_ENV } from "./ROOT_FILES_ENV";

/**
 * Drop root files this invocation did not publish itself.
 *
 * A root build hands its roots to every native host it spawns, and a host can
 * start another ttsc run in turn: `@ttsc/lint` evaluating a config file through
 * `ttsx`, for instance. That run compiles its own projects, and an inherited
 * list would replace their files with the outer run's root. The list is
 * per-invocation state the spawning host owns, the same rule the forwarded
 * tsgo argv follows. A caller that named the variable explicitly keeps it.
 */
export function clearInheritedRootFiles(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  if (callerEnv?.[ROOT_FILES_ENV] === undefined) {
    delete env[ROOT_FILES_ENV];
  }
}
