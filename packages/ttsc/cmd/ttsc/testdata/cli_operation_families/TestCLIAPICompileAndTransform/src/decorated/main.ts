import { Payload } from "./types";

const log = (): MethodDecorator => () => undefined;

export class Service {
  @log()
  public accept(payload: Payload): string {
    return payload.id;
  }
}
