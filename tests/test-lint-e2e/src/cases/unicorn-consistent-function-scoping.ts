export function formatNames(names: string[]): string[] {
  // expect: unicorn/consistent-function-scoping error
  function normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  return names.map(normalize);
}
