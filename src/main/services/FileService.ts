import { readdir, readFile, writeFile, mkdir, unlink, stat } from 'fs/promises'
import { dirname, isAbsolute, normalize, relative, resolve } from 'path'
import type { DirectoryEntry } from '@shared/types'

export class PathTraversalError extends Error {
  constructor(message = 'Path is outside the project folder') {
    super(message)
    this.name = 'PathTraversalError'
  }
}

export class FileService {
  constructor(private projectFolder: string) {}

  setProjectFolder(folder: string): void {
    this.projectFolder = folder
  }

  validatePath(relativePath: string): string {
    const projectRoot = resolve(this.projectFolder)
    const target = resolve(projectRoot, normalize(relativePath || '.'))
    const rel = relative(projectRoot, target)
    if (isAbsolute(rel) || rel.startsWith('..') || rel.includes('..\\') || rel.includes('../')) {
      throw new PathTraversalError()
    }
    return target
  }

  async readFile(relativePath: string): Promise<string> {
    const absolute = this.validatePath(relativePath)
    try {
      return await readFile(absolute, 'utf8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to read ${relativePath}: ${message}`)
    }
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const absolute = this.validatePath(relativePath)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, content, 'utf8')
  }

  async listDirectory(relativePath: string): Promise<DirectoryEntry[]> {
    const absolute = this.validatePath(relativePath || '.')
    const entries = await readdir(absolute, { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const absolute = this.validatePath(relativePath)
      await stat(absolute)
      return true
    } catch {
      return false
    }
  }

  async readAbsolute(absolutePath: string): Promise<string> {
    return readFile(absolutePath, 'utf8')
  }

  async writeAbsolute(absolutePath: string, content: string): Promise<void> {
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content, 'utf8')
  }

  async deleteAbsolute(absolutePath: string): Promise<void> {
    await unlink(absolutePath)
  }

  toRelative(absolutePath: string): string {
    const projectRoot = resolve(this.projectFolder)
    return normalize(absolutePath.slice(projectRoot.length + 1)).replace(/\\/g, '/')
  }

  getProjectFolder(): string {
    return this.projectFolder
  }
}
