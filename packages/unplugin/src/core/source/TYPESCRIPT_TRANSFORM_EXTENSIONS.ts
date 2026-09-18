import { TYPESCRIPT_TRANSFORM_SOURCES } from "./TYPESCRIPT_TRANSFORM_SOURCES";

/** Every source extension accepted by the ttsc transform. */
export const TYPESCRIPT_TRANSFORM_EXTENSIONS: readonly string[] =
  TYPESCRIPT_TRANSFORM_SOURCES.map(({ extension }) => extension);
