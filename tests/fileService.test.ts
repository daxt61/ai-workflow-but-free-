import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { FileService, PathTraversalError } from '../src/main/services/FileService'

// Feature: slowburn-agent, Property 1: File path sandboxing
describe('FileService', () => {
  let projectDir: string
  let fileService: FileService

  afterEach(async () => {
    if (projectDir) await rm(projectDir, { recursive: true, force: true })
  })

  async function setup(): Promise<void> {
    projectDir = await mkdtemp(join(tmpdir(), 'slowburn-'))
    fileService = new FileService(projectDir)
    await mkdir(join(projectDir, 'src'), { recursive: true })
    await writeFile(join(projectDir, 'src', 'index.ts'), 'hello', 'utf8')
  }

  it('reads and writes files within project', async () => {
    await setup()
    const content = 'export const x = 1'
    await fileService.writeFile('src/new.ts', content)
    expect(await fileService.readFile('src/new.ts')).toBe(content)
  })

  it('rejects path traversal', async () => {
    await setup()
    expect(() => fileService.validatePath('../../etc/passwd')).toThrow(PathTraversalError)
  })

  it('property: validatePath stays inside project or throws', async () => {
    await setup()
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 40 }), (rel) => {
        try {
          const resolved = fileService.validatePath(rel)
          expect(resolved.startsWith(projectDir)).toBe(true)
        } catch (err) {
          expect(err).toBeInstanceOf(PathTraversalError)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('property: write then read round-trip', async () => {
    await setup()
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.stringMatching(/^[a-z0-9_-]+\.txt$/),
        async (content, name) => {
          const path = `src/${name}`
          await fileService.writeFile(path, content)
          const read = await fileService.readFile(path)
          expect(read).toBe(content)
        }
      ),
      { numRuns: 20 }
    )
  })
})
