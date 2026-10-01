/** Renders a string for display. */
export function format(value: string): string;
/** Renders a number for display. */
export function format(value: number): string;
/** Renders either for display. */
export function format(value: string | number): string {
  return String(value);
}
