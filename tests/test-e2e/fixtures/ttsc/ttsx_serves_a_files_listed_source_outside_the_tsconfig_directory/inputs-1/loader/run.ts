declare const process: { stdout: { write(text: string): void } };
const main = async (): Promise<void> => {
  const mod: { default?: unknown } = await import(
    "../config/app.config.ts"
  );
  process.stdout.write(JSON.stringify(mod.default ?? mod));
};
void main();
