import { Calculator as Calc, type CalculatorShape, Offset } from "./Calculator";
import { CommentOnly } from "./CommentOnly";
import DefaultCounter, { BaseValue as CounterBase } from "./DefaultCounter";
import NamespacedDefault, * as Namespaced from "./Namespaced";
import { ShadowedLocal } from "./Shadow";
import type { Phantom } from "./types";

const phantom: Phantom | null = null;
const shape: CalculatorShape | null = null;

export const total =
  new Calc().add(2, 3) +
  new DefaultCounter().value +
  CounterBase +
  Offset.value +
  new NamespacedDefault().value +
  Namespaced.namespaceValue +
  (phantom === null ? 0 : 1);

console.log(
  `${total}:${ShadowedLocal}:${typeof CommentOnly}:${shape === null}`,
);
