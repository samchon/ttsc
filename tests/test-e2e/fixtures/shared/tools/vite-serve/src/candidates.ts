import { linked } from "linked-pkg";
export const value: string = linked;
(globalThis as Record<string, unknown>).ttscLinkedValue = value;
