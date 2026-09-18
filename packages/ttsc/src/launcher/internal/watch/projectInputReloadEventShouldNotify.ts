import path from "node:path";
import { type ProjectInputPathIdentity } from "../../../internal/pathIdentity/ProjectInputPathIdentity";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { literalGlobRoot } from "./literalGlobRoot";

/**
 * Classify an exact execution-selection input ahead of ordinary project data.
 *
 * `changedInputs` carries fingerprint or membership deltas, so a filename-less
 * event can still select the cold lane. A named exact event selects the cold
 * lane only after the surrounding change detector admits the event; unchanged
 * bytes remain quiet before this classifier is observed.
 */
export function projectInputReloadEventShouldNotify(input: {
  causedBy?: readonly string[];
  changed?: string;
  changedInputs: readonly string[];
  reloadDirectories?: readonly string[];
  reloadFiles: readonly string[];
  globs?: readonly string[];
}): boolean {
  const identities = createProjectInputPathIdentityContext();
  const reloadFiles = new Set(
    input.reloadFiles.map((location) => identities.resolve(location).key),
  );
  const reloadDirectories = (input.reloadDirectories ?? []).map((location) =>
    identities.resolve(location),
  );
  // Territory a declared glob is rooted at, judged against the resolution
  // directory that would otherwise claim it. A project root is published as a
  // resolution directory because the config lives there, so the directory a
  // glob is rooted at reads as a new immediate entry the moment it appears --
  // and appearing is what a declared population does. The data lane already
  // reports it, with program invalidation when the membership moved, which is
  // the cold-Program-same-process transition that belongs to data.
  //
  // Data can only carve out strictly below a resolution directory. A glob
  // rooted on that directory, or above it -- `literalGlobRoot` answers with the
  // volume root for a pattern with no literal prefix -- would otherwise exempt
  // everything the directory exists to classify, and the selection lane would
  // retire in silence. Its role predates any glob drawn around it.
  //
  // Only glob roots, either way. A declared file sitting directly in a
  // resolution directory is still a selection surface: its own bytes are what a
  // project rule reads to decide, once per execution.
  const globRoots = (input.globs ?? []).map((glob) =>
    identities.resolve(literalGlobRoot(glob)),
  );
  const exemptedFrom = (
    directory: ProjectInputPathIdentity,
    location: string,
  ): boolean =>
    globRoots.some(
      (globRoot) =>
        globRoot.key !== directory.key &&
        identities.isWithin(directory.path, globRoot.path) &&
        identities.isWithin(globRoot.path, location),
    );
  // A reload directory is a non-recursive surface: its digest covers its
  // immediate entries' names, kinds, and link targets, so it moves only when the
  // directory itself moves or when an entry it holds directly does. Matching the
  // whole subtree instead makes a resolution ancestor -- the lint config graph
  // publishes every node_modules level it searched, up to the filesystem root --
  // read every edit beneath it as a selection change, which restarts the sidecar
  // on each keystroke and ends warm reuse for any project inside one.
  const holdsAsImmediateEntry = (location: string): boolean => {
    const parent = identities.resolve(path.dirname(location)).key;
    return reloadDirectories.some(
      (directory) =>
        directory.key === parent && exemptedFrom(directory, location) === false,
    );
  };
  const namesDirectory = (location: string): boolean => {
    const key = identities.resolve(location).key;
    return reloadDirectories.some((directory) => directory.key === key);
  };
  // A digest delta on the directory itself is the only signal there is when the
  // entry that appeared is not a declared match, so it cannot simply be dropped
  // -- but it also cannot say what appeared. The event being classified in the
  // same pass can: when it names data, the delta it caused is that data's, and
  // when it names anything else, or nothing at all, the safe reading is that
  // resolution moved. A missed reselection is a wrong answer; a spare restart is
  // a slow one.
  const explains = (directory: ProjectInputPathIdentity): boolean => {
    const causes =
      input.causedBy ?? (input.changed === undefined ? [] : [input.changed]);
    // Only an immediate entry can move this directory's digest, so only an
    // immediate entry can account for the delta. Asking whether the event was
    // data somewhere else answers a different directory's question, and one
    // exemption would then cancel every other directory's evidence.
    return causes.some((location) => {
      const parent = identities.resolve(path.dirname(location)).key;
      return parent === directory.key && exemptedFrom(directory, location);
    });
  };
  const isReloadDirectoryEvent = (location: string): boolean =>
    namesDirectory(location) || holdsAsImmediateEntry(location);
  const isReloadDirectoryDelta = (location: string): boolean => {
    if (holdsAsImmediateEntry(location)) return true;
    const key = identities.resolve(location).key;
    return reloadDirectories.some(
      (directory) => directory.key === key && explains(directory) === false,
    );
  };
  return (
    (input.changed !== undefined &&
      (reloadFiles.has(identities.resolve(input.changed).key) ||
        isReloadDirectoryEvent(input.changed))) ||
    input.changedInputs.some(
      (location) =>
        reloadFiles.has(identities.resolve(location).key) ||
        isReloadDirectoryDelta(location),
    )
  );
}
