// expect: unicorn/no-unreadable-iife error
const r = (() => Math.random())();
void r;
