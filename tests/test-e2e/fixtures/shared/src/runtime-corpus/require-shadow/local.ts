export function value(): string {
  const require = (id: string): string => "local:" + id;
  return require("@lib/message");
}
