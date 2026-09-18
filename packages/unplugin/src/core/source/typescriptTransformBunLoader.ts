import { TYPESCRIPT_TRANSFORM_SOURCES } from "./TYPESCRIPT_TRANSFORM_SOURCES";

/** Select Bun's parser for an exact TypeScript transform source. */
export function typescriptTransformBunLoader(
  filePath: string,
): "ts" | "tsx" | undefined {
  return TYPESCRIPT_TRANSFORM_SOURCES.find(({ extension }) =>
    filePath.endsWith(extension),
  )?.bunLoader;
}
