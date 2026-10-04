export let frame: string | undefined;


try {
  throw new Error("inside");
} catch (error) {
  frame = (error as Error).stack?.split("\n")[1]?.trim();
}
