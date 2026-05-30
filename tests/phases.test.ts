import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { AGENT_PHASES } from '@shared/types'

// Feature: slowburn-agent, Property 4: Phase ordering invariant
describe('AGENT_PHASES', () => {
  it('has exactly 8 phases in the correct order', () => {
    expect(AGENT_PHASES).toHaveLength(8)
    expect(AGENT_PHASES).toEqual([
      'research',
      'planning',
      'implementation',
      'bug_detection',
      'code_review',
      're_coding',
      'optimization',
      'final_validation'
    ])
  })

  it('property: phase list is stable', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(AGENT_PHASES.length).toBe(8)
        expect(new Set(AGENT_PHASES).size).toBe(8)
      })
    )
  })
})
