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
 * every inherited `${configDir}` value made absolute so the wrapper does not
 * move it.
 *
 * The wrapper is the compiler's, so every path written into it is spelled as
 * the compiler spells the project: the compiler resolves the project to its
 * physical directory before it reads a config or hands a plugin its root, and a
 * relative plugin path or `${configDir}` value it would have resolved against
 * that directory is re-stated against it here (samchon/ttsc#1456).
 *
 * @param compiler The project's config path and directory as the compiler
 *   spells them.
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
