// expect: noLabels error
outer: for (let i = 0; i < 3; i++) {
  break outer;
}
