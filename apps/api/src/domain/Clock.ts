/** Time source abstraction so time-based rules (locks, timeouts) are testable. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
