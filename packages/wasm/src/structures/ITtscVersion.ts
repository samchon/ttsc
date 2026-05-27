/** Build metadata embedded in the wasm by the Go linker at compile time. */
export interface ITtscVersion {
  version: string;
  commit: string;
  date: string;
  go: string;
  goos: string;
  goarch: string;
}
