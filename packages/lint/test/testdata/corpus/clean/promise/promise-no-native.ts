// @ttsc-corpus-clean: promise/no-native
declare const Promise: { resolve(value: number): unknown }; Promise.resolve(1);
