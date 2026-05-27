/** Type shape returned by `getTypeAtPosition`. */
export interface ITtscTypeInfo {
  /** Printed type, equivalent to TypeScript's `TypeToString(t)`. */
  text: string;
  /** Numeric `TypeFlags` bitmask from TypeScript-Go. */
  flags: number;
}
