class Merged {
  value = 1;
}

// expect: noUnsafeDeclarationMerging error
interface Merged {
  other: string;
}
