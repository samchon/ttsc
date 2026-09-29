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
 * @evidence contracts/common.md#standard-implementation-practices The factory follows the maintained banner package's TypeScript entry and compiler-generated declaration convention, and the host's supported default-export factory protocol. node:path.resolve locates sibling native source from the supplied module directory. The package name and stage are protocol values; no consumer, fixture or test determines them, and the factory patches no foreign API.
 *
 * The prior handwritten CommonJS entry was outside TypeScript selection and could not be enrolled by the installed checker. The owning package now builds its TypeScript entry and declarations, removing the handwritten module.exports path without another adapter. Compiler-emitted CommonJS remains ordinary build output supported by the host's default-export loader. The build, Evidence check, ordinary/space/Unicode descriptor comparison and six existing paths feature cases verify registration and behavior; no performance improvement is claimed.
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
