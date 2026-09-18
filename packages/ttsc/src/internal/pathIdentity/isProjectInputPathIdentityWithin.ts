import { isFilesystemPathIdentityWithin } from "./isFilesystemPathIdentityWithin";

/**
 * Whether one project-input identity key contains another, using the host
 * platform's separator; the project-input name of
 * {@link isFilesystemPathIdentityWithin}.
 */
export function isProjectInputPathIdentityWithin(
  root: string,
  candidate: string,
): boolean {
  return isFilesystemPathIdentityWithin(root, candidate);
}
