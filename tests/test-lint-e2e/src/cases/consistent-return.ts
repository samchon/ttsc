// Positive: one branch returns a value, the other returns bare.
// expect: consistent-return error
function mixed(flag: boolean): number | undefined {
  if (flag) {
    return 1;
  }
  return;
}

// Negative: every `return` carries a value.
function always(flag: boolean): number {
  if (flag) {
    return 1;
  }
  return 2;
}

void [mixed, always];
