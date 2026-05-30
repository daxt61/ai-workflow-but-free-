export class CancellationError extends Error {
  constructor() {
    super('Task was cancelled')
    this.name = 'CancellationError'
  }
}

export class CancellationToken {
  private controller = new AbortController()

  cancel(): void {
    this.controller.abort()
  }

  get isCancelled(): boolean {
    return this.controller.signal.aborted
  }

  get signal(): AbortSignal {
    return this.controller.signal
  }

  throwIfCancelled(): void {
    if (this.isCancelled) throw new CancellationError()
  }

  reset(): void {
    this.controller = new AbortController()
  }
}
