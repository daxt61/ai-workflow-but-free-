import type { AgentPhase, LogEntry } from '@shared/types'
import type { DiffTracker } from '../services/DiffTracker'
import type { FileService } from '../services/FileService'
import type { SearchService } from '../services/SearchService'
import type { ShellService } from '../services/ShellService'
import { PathTraversalError } from '../services/FileService'

export class ToolExecutor {
  constructor(
    private fileService: FileService,
    private shellService: ShellService,
    private searchService: SearchService,
    private diffTracker: DiffTracker,
    private onLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void,
    private currentPhase: () => AgentPhase
  ) {}

  async execute(toolName: string, args: Record<string, string>): Promise<string> {
    const phase = this.currentPhase()

    this.onLog({
      type: 'tool_call',
      phase,
      content: `${toolName}(${JSON.stringify(args)})`
    })

    try {
      let result: string
      switch (toolName) {
        case 'read_file':
          result = await this.fileService.readFile(args.path)
          break
        case 'write_file':
          await this.diffTracker.snapshotBeforeWrite(this.fileService, args.path)
          await this.fileService.writeFile(args.path, args.content ?? '')
          result = `Successfully wrote ${args.path}`
          break
        case 'run_command':
          result = await this.runCommand(args.command)
          break
        case 'web_search': {
          const results = await this.searchService.search(args.query)
          if (!results.length) {
            result = 'No search results found.'
          } else {
            result = results
              .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
              .join('\n\n')
          }
          break
        }
        case 'list_directory': {
          const entries = await this.fileService.listDirectory(args.path || '.')
          result = entries.map((e) => `${e.isDirectory ? '[dir]' : '[file]'} ${e.name}`).join('\n')
          break
        }
        default:
          result = `Unknown tool: ${toolName}`
      }

      this.onLog({
        type: 'tool_result',
        phase,
        content: result.length > 2000 ? `${result.slice(0, 2000)}…` : result
      })
      return result
    } catch (err) {
      const message = err instanceof PathTraversalError ? err.message : (err instanceof Error ? err.message : String(err))
      this.onLog({ type: 'error', phase, content: message })
      return `Error: ${message}`
    }
  }

  private async runCommand(command: string): Promise<string> {
    const result = await this.shellService.execute(command, (line) => {
      this.onLog({
        type: 'tool_result',
        phase: this.currentPhase(),
        content: line,
        metadata: { stream: 'shell' }
      })
    })

    return [
      `exitCode: ${result.exitCode}`,
      result.timedOut ? '[TIMED OUT]' : '',
      result.stdout ? `stdout:\n${result.stdout}` : '',
      result.stderr ? `stderr:\n${result.stderr}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  }
}
