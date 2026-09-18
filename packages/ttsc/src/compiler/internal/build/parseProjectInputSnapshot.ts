import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { isAbsoluteLocalProjectInputPath } from "./isAbsoluteLocalProjectInputPath";

/**
 * Parse and validate the JSON a native host printed for `project-inputs`.
 *
 * Every path in the snapshot (root, files, globs, reload files and directories)
 * must be an absolute local path; a relative, empty, or device path is rejected
 * with the plugin's name, because a watcher cannot observe it and silently
 * dropping it would leave a declared input unwatched. Optional reload lists
 * default to empty.
 */
export function parseProjectInputSnapshot(
  text: string,
  plugin: ITtscLoadedNativePlugin,
): ITtscProjectInputSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `ttsc.project-inputs: ${plugin.name ?? plugin.binary} returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { root?: unknown }).root !== "string" ||
    !isStringArray((value as { files?: unknown }).files) ||
    !isStringArray((value as { globs?: unknown }).globs) ||
    ((value as { reloadDirectories?: unknown }).reloadDirectories !==
      undefined &&
      !isStringArray(
        (value as { reloadDirectories?: unknown }).reloadDirectories,
      )) ||
    ((value as { reloadFiles?: unknown }).reloadFiles !== undefined &&
      !isStringArray((value as { reloadFiles?: unknown }).reloadFiles))
  ) {
    throw new Error(
      `ttsc.project-inputs: ${plugin.name ?? plugin.binary} returned an invalid snapshot`,
    );
  }
  const snapshot = value as unknown as ITtscProjectInputSnapshot;
  const invalid = [
    ["root", snapshot.root],
    ...snapshot.files.map((file) => ["file", file] as const),
    ...snapshot.globs.map((glob) => ["glob", glob] as const),
    ...(snapshot.reloadDirectories ?? []).map(
      (directory) => ["reload directory", directory] as const,
    ),
    ...(snapshot.reloadFiles ?? []).map(
      (file) => ["reload file", file] as const,
    ),
  ].find(
    ([, location]) =>
      location.length === 0 || !isAbsoluteLocalProjectInputPath(location),
  );
  if (invalid !== undefined) {
    throw new Error(
      `ttsc.project-inputs: ${plugin.name ?? plugin.binary} returned an invalid snapshot: ${invalid[0]} ${JSON.stringify(invalid[1])} is not an absolute local path`,
    );
  }
  return {
    ...snapshot,
    reloadDirectories: snapshot.reloadDirectories ?? [],
    reloadFiles: snapshot.reloadFiles ?? [],
  };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
