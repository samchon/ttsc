let observed: number = 0;
function probe(...args: any[]): void {
  observed = args.length;
}
class Box {
  @probe
  method(): void {}
}
new Box();
export const decoratorArguments: number = observed;
