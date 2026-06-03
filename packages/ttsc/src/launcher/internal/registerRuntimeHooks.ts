import { installHooks } from "./runtime/runtimeHooks";

/**
 * `--import` entry point installed in the child process that runs the entry.
 *
 * It registers the synchronous module hooks so every `.ts` the entry reaches is
 * emitted on demand through the host that owns it. Each owning tsconfig is
 * resolved to its plugin host lazily on first emit (a dependency shipping raw
 * `.ts` plus its own typia/banner is served by that plugin's host), so the
 * parent passes only what host resolution needs — the ttsc helper binary, the
 * cache directory, the working directory, and the entry's tsconfig — through the
 * environment, keeping this module small.
 */
const ttscBinary = process.env["TTSX_TTSC_BINARY"] ?? "";
const cwd = process.env["TTSX_EMIT_HOST_CWD"] ?? process.cwd();
const entryTsconfig = process.env["TTSX_ENTRY_TSCONFIG"] ?? "";
const cacheDir = process.env["TTSX_CACHE_DIR"];

if (ttscBinary !== "" && entryTsconfig !== "") {
  installHooks({
    entryTsconfig,
    cwd,
    ttscBinary,
    cacheDir: cacheDir === undefined || cacheDir === "" ? undefined : cacheDir,
    noPlugins: process.env["TTSX_NO_PLUGINS"] === "1",
  });
}
