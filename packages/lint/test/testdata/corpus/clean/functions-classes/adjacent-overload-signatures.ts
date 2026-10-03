// @ttsc-corpus-clean: typescript/adjacent-overload-signatures
interface I { foo(): void; foo(x: number): void; bar(): void; }
