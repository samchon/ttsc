import fs from "node:fs";

/**
 * The filesystem primitives a {@link FilesystemPathIdentityContext} consults.
 *
 * Callers can supply a partial override to the creator and inherit host
 * defaults for omitted primitives. Overrides must describe one consistent
 * filesystem and match the selected platform's path grammar; combining foreign
 * path grammar with unrelated host probes cannot establish a coherent
 * identity.
 *
 * The case callback returns true or false only for established native policy;
 * undefined explicitly reports an unavailable determination. The resolver uses
 * established insensitivity for ASCII folding only; this callback supplies no
 * native Unicode case or normalization table.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath, tri-state directory case judgment and path grammar define identity premises; undefined preserves unestablished policy, optional stat/list primitives support the default probe, and explicit error policy distinguishes strict from best-effort resolution.
 * @evidence contracts/common.md#clear-and-simple-design One dependency record groups the resolver's required decisions and optional native probe primitives; Partial overrides and default assembly belong to the creator rather than to each operation signature.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit injection replaces only this owned boundary, not foreign globals; a consistent filesystem/platform premise is required instead of accepting fabricated aliases or treating an OS name as measured directory policy.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain partial overrides, host defaults and coherent filesystem/path semantics; member descriptions state defaults and error-policy consequences with documentation-skill member and tag separation.
 * @evidence contracts/portability.md#os-neutral-implementation Platform selects native path grammar, while realpath and directory capability probes establish identity; unknown case policy is explicit and does not inherit a platform default, and volume-root formatting remains a separate concern.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type FilesystemPathIdentityOperations = {
  /**
   * Whether ASCII names inside `directory` are compared case-sensitively. The
   * resolver queries a resolved ancestor when interpreting unresolved suffixes
   * or answering an explicit directory-policy query; if no existing prefix
   * resolves, it can query the volume root. Return true for established
   * sensitivity, false for established insensitivity or undefined if the policy
   * cannot be established. Existing boolean-returning callbacks remain valid.
   *
   * @evidence contracts/common.md#principled-implementation Established directory policy supplies the unresolved-suffix ASCII equivalence premise, and undefined preserves inability to establish it; only false authorizes ASCII folding, independently of volume-root formatting and unproved Unicode equivalence. Best-effort resolution does not prove that such suffix entries are absent.
   * @evidence contracts/common.md#clear-and-simple-design One callback reports sensitive, insensitive or unknown capability while accepting existing boolean implementations; the creator owns memoization and suffix handling rather than duplicating them in injected probes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Injected results must report actual established policy or unknown, not special-filename answers or OS defaults chosen to produce desired identity equality.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains directory scope, explicit-query use, all three result states and boolean callback compatibility, with separate method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The callback represents native directory case capability, supporting case-sensitive Windows directories and case-insensitive POSIX volumes without deriving the answer solely from an operating-system name.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources caseSensitive declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms caseSensitive declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work caseSensitive declares a signature only; the implementation owns any shared work.
   */
  caseSensitive(directory: string): boolean | undefined;

  /**
   * Link-preserving stat the default case-sensitivity probe uses to test
   * whether a name opens under its alternate case. Defaults to `fs.lstatSync`.
   *
   * @evidence contracts/common.md#principled-implementation Link-preserving metadata lets the default case probe test a candidate name without confusing that entry with a followed link target; native errors preserve whether the alternate spelling was absent or observation failed.
   * @evidence contracts/common.md#clear-and-simple-design This optional primitive supports the default capability probe, with omitted-operation defaulting owned by the creator and case classification owned by that probe.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A supported callback supplies real stat results instead of mutating fs.lstatSync or returning a guessed affirmative answer for selected alternate names.
   * @evidence contracts/common.md#meaningful-documentation Native prose states link preservation, alternate-case purpose and the default implementation, with tags separated under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native link-preserving stat and either Stats representation retain filesystem metadata semantics; callers need no shell command or platform-specific filename heuristic at this boundary.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources lstat declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms lstat declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work lstat declares a signature only; the implementation owns any shared work.
   */
  lstat?(location: string): fs.Stats | fs.BigIntStats;

  /**
   * Path semantics to apply. `win32` selects backslash separators, drive and
   * UNC roots, and a case-folded volume key; anything else is POSIX.
   */
  platform: NodeJS.Platform;

  /**
   * Directory listing the default case-sensitivity probe reads. Defaults to
   * `fs.readdirSync`.
   *
   * @evidence contracts/common.md#principled-implementation Listing actual immediate entry names gives the default case probe candidate spellings and distinct folded-name evidence; the operation returns names rather than resolving entries or asserting case policy itself.
   * @evidence contracts/common.md#clear-and-simple-design An optional name-list primitive supplies only enumeration to the default probe; the creator owns defaults and the probe owns interpretation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Names must come from the actual directory rather than a fixed fixture list or patched global enumeration that makes a desired case decision appear supported.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies probe use and fs.readdirSync default; its separate method acknowledgment block follows the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native directory enumeration returns immediate names without a shell listing or hardcoded path separator; interpretation uses the selected filesystem's case behavior.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources readdir declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms readdir declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work readdir declares a signature only; the implementation owns any shared work.
   */
  readdir?(directory: string): string[];

  /**
   * Physical path of an existing entry. Defaults to `fs.realpathSync.native`,
   * which, unlike the JavaScript implementation, also expands Windows 8.3 short
   * names.
   *
   * @evidence contracts/common.md#principled-implementation Physical resolution identifies the existing prefix used to anchor unresolved suffixes; operation errors remain available to the creator's strict or best-effort policy rather than being silently converted by the signature.
   * @evidence contracts/common.md#clear-and-simple-design One physical-path primitive delegates alias expansion to the filesystem and leaves memoization, missing ancestors and error classification with the creator.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native realpath results replace actual aliases instead of manually guessing a target or globally rewriting foreign filesystem behavior.
   * @evidence contracts/common.md#meaningful-documentation Native prose states existing-entry physical resolution and why the native default matters for Windows short names, with separated method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Physical resolution must honor native aliases, including Windows short names; path grammar and directory case interpretation remain separate capabilities instead of substitutes for realpath.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources realpath declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms realpath declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work realpath declares a signature only; the implementation owns any shared work.
   */
  realpath(location: string): string;

  /**
   * When `true` (the default), a realpath failure other than a missing entry
   * propagates. When `false`, every failure is treated as an unavailable
   * physical observation and resolution continues with the parent. This does
   * not establish absence: existing inaccessible entries can become part of the
   * unresolved suffix used by best-effort callers such as runtime hooks.
   */
  throwOnRealpathError: boolean;
};
