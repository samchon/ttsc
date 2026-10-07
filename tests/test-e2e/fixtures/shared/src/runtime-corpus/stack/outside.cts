export let frame: string | undefined;


try {
  throw new Error("outside");
} catch (error) {
  frame = (error as Error).stack?.split("\n")[1]?.trim();
}
