import type fs from "node:fs";

/** Filesystem facts required to discover an implicit TypeScript project. */
export interface TtscProjectDiscoveryFilesystem {
  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;
  /** Read metadata while following links, like an ordinary config-file open. */
  stat(
    location: string,
  ): Pick<fs.Stats, "isFile"> & Partial<Pick<fs.Stats, "isDirectory">>;
}
