import { observed } from "./standard/index.cjs";
const state = globalThis as typeof globalThis & { batchEnumLoads?: number };
state.batchEnumLoads = (state.batchEnumLoads ?? 0) + 1;
export const enum Value { Entry = 42 }
export interface OnlyType { value: number }
export const actual = 17;
export let live = 42;
export function change(): void { live = 43; }
export const decorators = observed;
export function loadCount(): number { return state.batchEnumLoads!; }
