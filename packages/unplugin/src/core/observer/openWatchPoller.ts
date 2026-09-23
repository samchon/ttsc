/**
 * Open the shared fallback poll that checks inputs no native scope can cover.
 *
 * One unreferenced interval serves every such input. Each tick checks a bounded
 * slice, so idle CPU cost stays constant however many inputs fall back.
 */
export function openWatchPoller(listener: () => void): { close(): void } {
  const timer = setInterval(listener, 500);
  timer.unref();
  return { close: () => clearInterval(timer) };
}
