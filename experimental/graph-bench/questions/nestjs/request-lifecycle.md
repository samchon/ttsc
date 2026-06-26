For a NestJS HTTP request reaching a controller method, trace the runtime path that applies guards, pipes, and interceptors before invoking the controller callback. Start from the route handler wrapper and follow it to where each framework concern actually runs.

List the ordered symbols and show where guards, interceptors, and pipes execute relative to the controller callback. Do not guess; report gaps.
