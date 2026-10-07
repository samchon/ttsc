import { LOADER_IDENTITIES } from "./LOADER_IDENTITIES";

/**
 * Every spelling a caller can wire the loader with: bare identities and
 * option-bearing objects.
 */
export const LOADER_FORMS = LOADER_IDENTITIES.flatMap((loader) => [
  loader,
  { loader, options: { configured: true } },
]);
