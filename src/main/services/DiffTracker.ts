import type { ApplyResult, FileDiff } from '@shared/types'
import type { FileService } from './FileService'

export class DiffTracker {
  private snapshots = new Map<string, string | null>()

  reset(): void {
    this.snapshots.clear()
  }

  async snapshotBeforeWrite(fileService: FileService, relativePath: string): Promise<void> {
    const absolute = fileService.validatePath(relativePath)
    if (this.snapshots.has(absolute)) return

    try {
      const content = await fileService.readAbsolute(absolute)
      this.snapshots.set(absolute, content)
    } catch {
      this.snapshots.set(absolute, null)
    }
  }

  async computeDiffs(fileService: FileService): Promise<FileDiff[]> {
    const diffs: FileDiff[] = []

    for (const [absolute, original] of this.snapshots) {
      const relativePath = fileService.toRelative(absolute)
      let modifiedContent = ''
      let exists = false

      try {
        modifiedContent = await fileService.readAbsolute(absolute)
        exists = true
      } catch {
        exists = false
      }

      if (original === null && exists) {
        diffs.push({
          relativePath,
          originalContent: '',
          modifiedContent,
          status: 'created'
        })
      } else if (original !== null && !exists) {
        diffs.push({
          relativePath,
          originalContent: original,
          modifiedContent: '',
          status: 'deleted'
        })
      } else if (original !== null && exists && original !== modifiedContent) {
        diffs.push({
          relativePath,
          originalContent: original,
          modifiedContent,
          status: 'modified'
        })
      }
    }

    return diffs
  }

  async applyAll(): Promise<ApplyResult> {
    // Changes are already written to disk during the task; apply confirms and clears snapshots.
    this.reset()
    return { success: true, failedFiles: [] }
  }

  async discardAll(fileService: FileService): Promise<void> {
    for (const [absolute, original] of this.snapshots) {
      try {
        if (original === null) {
          await fileService.deleteAbsolute(absolute)
        } else {
          await fileService.writeAbsolute(absolute, original)
        }
      } catch (err) {
        console.error('[SlowBurn] Failed to restore file:', absolute, err)
      }
    }
    this.reset()
  }
}
