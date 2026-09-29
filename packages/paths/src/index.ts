import path from "node:path";

/**
 * Locate the native paths transform for the ttsc plugin host.
 *
 * The host supplies this module's absolute directory in `context.dirname`.
 * The descriptor points to the sibling Go driver; compiler options and source
 * rewriting are consumed by that driver rather than evaluated by this factory.
 *
 * The factory reads no external config file. Its empty host-input hashes let
 * the host reuse descriptor evaluation under the observed module graph without
 * claiming that the native transform has no project-wide dependencies.
 *
 * @evidence contracts/common.md#no-implementation-shortcuts The name and stage identify the native plugin protocol; source selection uses the host's directory through node:path, with no fixture decision, foreign mutation or test-only branch. The former handwritten CommonJS entry was omitted by source selection and rejected when enrolled. This owning TypeScript factory replaces it, removing the handwritten module.exports path without an adapter or fallback. The package build, Evidence check and descriptor comparison probe verify its source and unchanged registration values.
 * @evidence contracts/common.md#portable-behavior node:path.resolve constructs the absolute sibling driver path from the host-supplied dirname on Windows and POSIX. The factory performs no filesystem reads or process invocation and uses no ambient __dirname; its empty input map introduces no platform-specific state.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the host directory, driver ownership and the limited meaning of descriptor-input reuse in separate paragraphs. Context and result members describe their consuming protocol rather than repeating their types, following the documentation skill's clear prose and rationale guidance; the maintainer walkthrough is updated for the built entry.
 */
export default function createTtscPaths(
  context: TtscPathsFactoryContext,
): TtscPathsDescriptor {
  return {
    // The descriptor reads no file outside its module graph, which lets a
    // launch reuse its evaluation (samchon/ttsc#1561).
    hostInputHashes: {},
    name: "@ttsc/paths",
    // `context.dirname` is this descriptor's own directory in every load mode —
    // the ESM-safe replacement for `__dirname`.
    source: path.resolve(context.dirname, "..", "driver"),
    stage: "transform",
  };
}

/** The part of the host factory context this descriptor reads. */
type TtscPathsFactoryContext = {
  /** Absolute directory of the loaded descriptor module in every load mode. */
  dirname: string;
};

/** Native transform registration returned to the ttsc plugin host. */
type TtscPathsDescriptor = {
  /** No external files are read while this factory constructs its descriptor. */
  hostInputHashes: Record<string, string | null>;
  /** Package identity used for diagnostics and plugin registration. */
  name: string;
  /** Absolute Go source directory compiled and linked by the host. */
  source: string;
  /** Register source rewriting in the transform stage. */
  stage: "transform";
};
