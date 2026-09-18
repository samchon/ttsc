import { LOADER_IDENTITIES } from "./LOADER_IDENTITIES";

export const LOADER_FORMS = LOADER_IDENTITIES.flatMap((loader) => [
  loader,
  { loader, options: { configured: true } },
]);
