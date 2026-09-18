/** Whether libuv rejected process stdio because a source descriptor was high. */
export function isSpawnSyncFdExhaustion(error: Error | undefined): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EBADF" || error?.message.includes("EBADF") === true;
}
