import type fs from "node:fs";

import type { TtscProjectDiscoveryFilesystem } from "./TtscProjectDiscoveryFilesystem";

/** Directory enumeration required to discover every implicit child project. */
export interface TtscProjectTreeDiscoveryFilesystem extends TtscProjectDiscoveryFilesystem {
  /** Enumerate one lexical directory and identify child directory links. */
  readdir(
    location: string,
  ): readonly (Pick<fs.Dirent, "isDirectory" | "name"> &
    Partial<Pick<fs.Dirent, "isSymbolicLink">>)[];
  /** Resolve physical directory identity for cycle-safe linked traversal. */
  realpath?(location: string): string;
}
