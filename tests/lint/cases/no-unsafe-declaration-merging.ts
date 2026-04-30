class Merged {
  value = 1;
}

// expect: no-unsafe-declaration-merging error
interface Merged {
  other: string;
}
