// @ts-ignore The shared ESNext-only program does not enroll Node declaration libraries.
import { URL } from "node:url";
// @ts-ignore Preserve the actual native query-bearing source specifier.
const query = await import("./suffix-value.js?query");
// @ts-ignore Preserve the actual native hash-bearing source specifier.
const hash = await import("./suffix-value.js#hash");
export const observed = { query: new URL(query.href).search, hash: new URL(hash.href).hash };
