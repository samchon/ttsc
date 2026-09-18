/** Build the fixed cmd.exe switch sequence for one already quoted payload. */
export function windowsGoCommandArgs(payload: string): string[] {
  return ["/d", "/v:off", "/s", "/c", payload];
}
