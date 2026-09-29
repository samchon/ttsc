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
 * @evidence contracts/common.md#principled-implementation
 *   The factory follows the maintained banner package's TypeScript entry and
 *   compiler-generated declaration convention, and the host's supported
 *   default-export factory protocol. node:path.resolve locates sibling native
 *   source from the supplied module directory.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The package name and stage are protocol values; no consumer, fixture or
 *   test determines them, and the factory patches no foreign API.
 *
 *   The TypeScript entry and generated declarations replace the handwritten
 *   CommonJS entry and declaration path. Compiler-emitted CommonJS uses the
 *   host's default-export loader without a separate runtime adapter.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   node:path.resolve constructs the absolute sibling driver path from the
 *   host-supplied dirname on Windows and POSIX. Native roots and separators
 *   come from that supplied directory, rather than an ambient __dirname or a
 *   manually concatenated path.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains the host directory, driver ownership and the
 *   limited meaning of descriptor-input reuse in separate paragraphs. Context
 *   and result members describe their consuming protocol rather than
 *   repeating their types, following the documentation skill's clear prose
 *   and rationale guidance; the maintainer walkthrough is updated for the
 *   built entry.
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
