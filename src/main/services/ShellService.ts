import { spawn } from 'child_process'
import type { ShellResult } from '@shared/types'

export class ShellCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShellCommandError'
  }
}

export class ShellService {
  constructor(
    private projectFolder: string,
    private timeoutMs = 120_000
  ) {}

  setProjectFolder(folder: string): void {
    this.projectFolder = folder
  }

  validateCommand(command: string): void {
    const patterns = [/\.\.(\/|\\)/, /(^|[\s;&|])(cd\s+)?\.\.($|[\s;&|])/i]
    for (const pattern of patterns) {
      if (pattern.test(command)) {
        throw new ShellCommandError('Shell command contains path traversal sequences')
      }
    }
  }

  async execute(command: string, onOutput?: (line: string) => void): Promise<ShellResult> {
    this.validateCommand(command)

    return new Promise((resolvePromise) => {
      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : '/bin/bash'
      const shellArgs = isWin ? ['/c', command] : ['-c', command]

      const child = spawn(shell, shellArgs, {
        cwd: this.projectFolder,
        env: process.env
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, this.timeoutMs)

      const emitLine = (chunk: string, stream: 'stdout' | 'stderr'): void => {
        const text = chunk.toString()
        if (stream === 'stdout') stdout += text
        else stderr += text
        const lines = text.split(/\r?\n/)
        for (const line of lines) {
          if (line && onOutput) onOutput(line)
        }
      }

      child.stdout?.on('data', (d) => emitLine(d, 'stdout'))
      child.stderr?.on('data', (d) => emitLine(d, 'stderr'))

      child.on('close', (code) => {
        clearTimeout(timeout)
        resolvePromise({
          exitCode: timedOut ? -1 : (code ?? -1),
          stdout,
          stderr: timedOut ? `${stderr}\n[Command timed out after ${this.timeoutMs}ms]` : stderr,
          timedOut
        })
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        resolvePromise({
          exitCode: -1,
          stdout,
          stderr: err.message,
          timedOut: false
        })
      })
    })
  }
}
