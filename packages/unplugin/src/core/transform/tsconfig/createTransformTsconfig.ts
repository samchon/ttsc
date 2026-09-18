import fs from "node:fs";
import path from "node:path";

import { createAliasCompilerOptions } from "../alias/createAliasCompilerOptions";
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
 */
export function createTransformTsconfig(
  props: {
    aliasPaths: Record<string, string[]>;
    compilerOptions: Record<string, unknown>;
    tsconfig: string;
  },
  scratchDirectory: string,
  state: ITransformTsconfigState,
): { path: string } {
  const overlay = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props, state.effectivePaths),
    },
    path.dirname(props.tsconfig),
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
        extends: normalizePath(props.tsconfig),
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
