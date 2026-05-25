// expect: noShadowRestrictedNames error
function f(undefined: number) {
  return undefined;
}
f(1);
