/**
 * A tall comment separates authored and emitted positions.
 *
 * padding
 * padding
 * padding
 * padding
 * padding
 * padding
 */
export function used(unusedParameter?: string): string { const unusedLocal = 1; return "used ran"; }
export function unused(): string { return "unused never runs"; }
export function depBoom(): never {
  throw new Error("dependency boom");
}
