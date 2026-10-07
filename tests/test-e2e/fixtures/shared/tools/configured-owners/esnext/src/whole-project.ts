import type { Brand } from "./brand";
export function wrap(value: number): Brand<number> { return value as Brand<number>; }
export const inside = "inside";
