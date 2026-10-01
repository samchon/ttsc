export function declared(): void {}
export const arrow = (): void => {};
export const expression = function (): void {};

export class Service {
  public run(): void {}
  public execute = (): void => {};
  public callback!: () => void;
  public static create(): Service { return new Service(); }
  public static restore = function (): Service { return new Service(); };
  public static provider?: () => Service;
}

export namespace Orders {
  export function open(): void {}
  export const close = (): void => {};
}
