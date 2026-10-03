import fs from "node:fs";
import path from "node:path";

import { createAliasCompilerOptions } from "../alias/createAliasCompilerOptions";
import { hostSpelling } from "../envelope/hostSpelling";
import { normalizePath } from "../filesystem/normalizePath";
import type { ITransformTsconfigState } from "./ITransformTsconfigState";
import { normalizeCompilerOptionsForGeneratedTsconfig } from "./normalizeCompilerOptionsForGeneratedTsconfig";

/**
 * Materialize the tsconfig a transform compile runs against.
 *
 * When the adapter adds nothing (no compiler-options overlay and no aliases),
 * the project's own tsconfig is used unchanged. Otherwise a wrapper that
 * `extends` it is written into the adapter-owned scratch directory, outside the
 * project, so it never becomes a project input. The wrapper carries the
 * overlay, the translated aliases re-stated over the effective `paths`, and
 * supported inherited `${configDir}` path options and file-selection fields
 * reanchored so the wrapper does not move their meaning.
 *
 * The supplied compiler config directory anchors supported path fields and
 * plugin addresses (samchon/ttsc#1456). It is the shared selector's best-effort
 * spelling, not proof every native realpath succeeded or will stay unchanged.
 *
 * @param compiler The project's config path and directory as the compiler
 *   spells them.
 *
 * @evidence contracts/common.md#principled-implementation The unchanged-config path avoids unnecessary wrapping; a needed wrapper extends the selected compiler config and reanchors supported inherited templates and aliases to its current directory so scratch placement does not move those paths.
 * @evidence contracts/common.md#clear-and-simple-design Existing alias and normalization helpers construct one overlay, while this operation owns only deciding whether to write and materializing the wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper preserves inherited template semantics instead of adding synthetic baseUrl, rewriting project files or compensating for scratch-directory misanchoring.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the no-overlay path, scratch ownership, inherited configDir behavior and the compiler's physical spelling; inline comments explain why inherited templates are restated.
 * @evidence contracts/portability.md#os-neutral-implementation The supplied best-effort compiler directory and hostSpelling translate supported native path fields; Node path addresses the owned scratch file, and slash encoding applies to compiler protocol values. Actual fs writes use the native host, not arbitrary injected view semantics or a shell.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Overlay spreads and alias/normalization work depend on option, alias, list
 *   and target counts/path text. Empty overlay returns the original config;
 *   otherwise compiler options/template file fields are serialized to B JSON
 *   bytes and synchronously written, retaining output objects/text until return.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Materializing a fixed filename in one generation's owned scratch directory
 *   is an ownership-bearing effect, not a reusable result merely because two
 *   callers supply equal options. Read-state sharing belongs to capture.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   A needed wrapper is a retained native artifact in the supplied owned scratch
 *   directory. Capture owns that directory's later removal, including failed
 *   or partial native writes; this function neither closes the generation nor
 *   installs its own cleanup timer. Empty-overlay return creates no artifact.
 */
export function createTransformTsconfig(
  props: {
    aliasPaths: Record<string, string[]>;
    compilerOptions: Record<string, unknown>;
    tsconfig: string;
  },
  scratchDirectory: string,
  state: ITransformTsconfigState,
  compiler: { configDir: string; tsconfig: string },
): { path: string } {
  // The adapter's own reading, the effective `paths` among it, spelled the
  // project as named; the wrapper speaks the compiler's spelling throughout.
  const spell = hostSpelling(
    { physical: compiler.configDir, spelling: path.dirname(props.tsconfig) },
    compiler.configDir,
  );
  const overlay = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props, state.effectivePaths),
    },
    compiler.configDir,
    spell,
  );
  if (Object.keys(overlay).length === 0) {
    return { path: props.tsconfig };
  }

  // A `${configDir}` value survives every `extends` hop and binds only at the
  // final consumer. The scratch wrapper would therefore move it out of the
  // project even for an unrelated overlay. Re-state only those inherited
  // values as absolute paths so the wrapper remains semantically transparent.
  const compilerOptions = {
    ...state.templateCompilerOptions,
    ...overlay,
  };
  const file = path.join(scratchDirectory, "tsconfig.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: normalizePath(compiler.tsconfig),
        ...state.templateFileSpecs,
        compilerOptions,
      },
      null,
      2,
    ),
    "utf8",
  );
  return { path: file };
}
