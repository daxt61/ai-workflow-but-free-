export class CancellationError extends Error {
  constructor() {
    super('Task was cancelled')
    this.name = 'CancellationError'
  }
}

export class CancellationToken {
  private _cancelled = false
  private _controller = new AbortController()

  cancel(): void {
    this._cancelled = true
    this._controller.abort()
  }

  get isCancelled(): boolean {
    return this._cancelled
  }

  throwIfCancelled(): void {
    if (this._cancelled) throw new CancellationError()
  }

  reset(): void {
    this._cancelled = false
    this._controller = new AbortController()
  }

  get signal(): AbortSignal {
    return this._controller.signal
  }
}
