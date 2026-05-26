class Merged {
  value = 1;
}

// expect: typescript/no-unsafe-declaration-merging error
interface Merged {
  other: string;
}
