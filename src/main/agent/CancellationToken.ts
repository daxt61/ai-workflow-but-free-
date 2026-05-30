export class CancellationError extends Error {
  constructor() {
    super('Task was cancelled')
    this.name = 'CancellationError'
  }
}

export class CancellationToken {
  private _cancelled = false

  cancel(): void {
    this._cancelled = true
  }

  get isCancelled(): boolean {
    return this._cancelled
  }

  throwIfCancelled(): void {
    if (this._cancelled) throw new CancellationError()
  }

  reset(): void {
    this._cancelled = false
  }
}
