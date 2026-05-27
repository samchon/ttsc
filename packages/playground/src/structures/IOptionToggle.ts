/**
 * Toggle metadata the OptionsPanel renders.
 *
 * Sites declare these for whatever transform plugins their wasm registered;
 * the panel renders one row per entry and bubbles `onChange` with the merged
 * options object.
 */
export interface IOptionToggle {
  key: string;
  label: string;
  description: string;
}
