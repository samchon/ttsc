/**
 * What a `ttscserver` session's plugin selection was loaded from, as the native
 * host receives it in the plugin manifest (`selectionInputs`), so a change to
 * any of it ends the session (samchon/ttsc#1507).
 *
 * Both kinds of input travel by directory, each directory with the names of the
 * files in it and the digest each had
 * (`LSPProjectInputDigest.lspProjectInputFileDigest`). The descriptors' inputs
 * are mostly resolution candidates that do not exist, a thousand of them across
 * a few dozen directories, and a plugin's Go sources can be thousands of files,
 * so the host resolves the identity of a directory once rather than of every
 * file. A source directory's listing is an input too, counted by the build's
 * own rule: a residue file or a directory the build passes over changes
 * nothing.
 *
 * @evidence contracts/common.md#principled-implementation Separate descriptor candidates and source-directory listings encode different invalidation meaning; digests preserve missing candidates while shared builder omission rules define which source entries can change selection.
 * @evidence contracts/common.md#clear-and-simple-design Directory-to-basename maps match the native observer's unit of identity resolution; omission vocabulary travels as data rather than becoming a second independently maintained source policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recorded file state comes from the selection's actual inputs, and source filters are shared builder rules rather than consumer or fixture exceptions.
 * @evidence contracts/common.md#meaningful-documentation The interface and member comments explain directory grouping, missing candidates and listing exclusions; documented members have blank source lines and tags are separated according to the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Declared native directories and entry names travel separately so the native host resolves actual directory identity without replacing path spellings with an OS-wide case assumption.
 */
export interface ILSPPluginSelectionInputs {
  /**
   * Every directory holding a file the plugin load read or probed, with the
   * name of each such file and its digest: the project's config chain, the
   * manifests plugin discovery reads, the descriptors, and what they resolved.
   * Only those files count.
   */
  descriptorFiles: Record<string, Record<string, string>>;

  /**
   * Every plugin source directory an observer watches
   * (`collectPluginSourceDirectories`), with the name of every file directly
   * inside it that the build keys on (`collectPluginSourceFiles`) and its
   * digest.
   */
  sourceFiles: Record<string, Record<string, string>>;

  /**
   * The names of files the build never keys on
   * (`GoSourceInputs.OMITTED_SOURCE_FILE_NAMES`), whose appearance in a source
   * directory changes nothing.
   */
  omittedNames: readonly string[];

  /**
   * The suffixes of files the build never keys on
   * (`GoSourceInputs.OMITTED_SOURCE_FILE_SUFFIXES`), such as an editor's `~`
   * backups.
   */
  omittedSuffixes: readonly string[];

  /**
   * The names of directories the build passes over
   * (`GoSourceInputs.PRUNED_SOURCE_DIRECTORY_NAMES`), whose appearance changes
   * nothing.
   */
  prunedDirectoryNames: readonly string[];
}
