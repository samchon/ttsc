import type { Secret } from "./secret.server";
export const value: string = goUpper("plugin");
export function fail(): never {
  throw new Error("authored");
}
