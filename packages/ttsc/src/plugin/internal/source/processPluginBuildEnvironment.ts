import { PluginBuildEnvironmentReadings } from "./PluginBuildEnvironmentReadings";

/**
 * The environment a plugin build in `directory` is keyed on under this
 * process's variables (`pluginBuildEnvironment`), read once per process and
 * directory while what it depended on holds, unless `refresh` asks for it
 * again.
 *
 * Reading it probes `go env` and walks GOROOT metadata. A changed compiler
 * metadata/context memo also runs `go version` and reads the binary, and a
 * changed SDK manifest rehashes all contributing content. A consumer that
 * proves a plugin source's state for every adoption, record, or delivery would
 * pay that each time, for an environment that changes with the process's
 * variables and otherwise almost never. The read is therefore kept under the
 * variables it was taken with, all of them, so a changed variable reads it
 * again, and with the metadata of every path it depended on that no variable
 * carries (`PluginBuildEnvironmentWitness`): the Go tool, the Go environment
 * file `go env -w` writes, the executables the C toolchain commands name, and
 * GOROOT. A kept read is reused only while each of them holds its metadata, so
 * a toolchain replaced in place or a `go env -w` is read at the next use, not
 * after a proof has already accepted the old reading. The
 * build itself never reads through here: it keys each binary on a fresh read.
 *
 * @param directory The directory a build runs `go` in.
 * @param refresh Whether to read the environment again rather than reuse it.
 *
 * @evidence contracts/common.md#principled-implementation Variable serialization is sorted and length-delimited; reuse additionally requires unchanged pre-read metadata for every external dependency, including all contributing GOROOT directories and files, under the witness's documented metadata-distinguishability premise.
 * @evidence contracts/common.md#clear-and-simple-design One process-local map owns environment memoization; fresh construction and witness validation remain separate operations shared with build verification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Refresh performs the real environment read rather than assuming that a stable compiler path or quiet source tree implies a stable toolchain.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why environment probing is retained, its variable/path invalidation, and why builds still read fresh; descriptive prose and tags are separated.
 * @evidence contracts/portability.md#os-neutral-implementation Native environment and filesystem identity are delegated to the shared platform-aware probe and metadata witness rather than inferred from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms For V environment variables and P witnessed paths a hit costs sorting O(V log V) plus O(P) metadata probes; it avoids subprocesses and content reads while still inspecting dependencies required for validity.
 * @evidence contracts/performance.md#reuse-equivalent-work Directory and all effective variables identify a candidate reading; the complete external-path witness must hold, otherwise the environment is read and its record replaced.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This process owns the map until termination. Entries are replaced for an existing key but distinct directory/variable combinations have no eviction bound; long-lived processes with changing contexts retain historical witnesses.
 */
export function processPluginBuildEnvironment(
  directory: string,
  refresh = false,
): string {
  return PluginBuildEnvironmentReadings.read(directory, refresh);
}
