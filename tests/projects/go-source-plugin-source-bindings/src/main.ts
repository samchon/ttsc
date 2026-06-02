import { Calculator as Calc, Offset } from "./Calculator";
import DefaultCounter from "./DefaultCounter";
import { ShadowedLocal } from "./Shadow";
import type { Phantom } from "./types";

const phantom: Phantom | null = null;

export const total =
  new Calc().add(2, 3) +
  new DefaultCounter().value +
  Offset.value +
  (phantom === null ? 0 : 1);

console.log(`${total}:${ShadowedLocal}`);
