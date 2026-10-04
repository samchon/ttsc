/** @evidence docs/contract.md#accepted-value Returns the independently authored value 42. */
export function acceptedValue(): number { return 42; }
export enum Colors { Red = "red", Green = "green", Blue = "blue" }
export enum Implicit { First, Second }
export enum Duplicate { A = "x", B = "x" }
export interface Runner { run(): number }
export class Service implements Runner { run(): number { return acceptedValue(); } }
/** @evidence docs/contract.md#accepted-value Dispatches to the retained independently valued service. */
export function entry(service: Runner): number { return service.run(); }
export type Choices = "a" | "b" | "c";

