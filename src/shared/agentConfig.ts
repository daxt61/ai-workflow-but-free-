import type { AgentPhase } from './types'

/** Target total task duration: 30–60 minutes across 8 phases. */
export const TARGET_TASK_MIN_MS = 30 * 60 * 1000
export const TARGET_TASK_MAX_MS = 60 * 60 * 1000

/** Minimum wall-clock time per phase before the agent may finish the phase. */
export const MIN_PHASE_MS: Record<AgentPhase, number> = {
  research: 5 * 60 * 1000,
  planning: 4 * 60 * 1000,
  implementation: 8 * 60 * 1000,
  bug_detection: 4 * 60 * 1000,
  code_review: 4 * 60 * 1000,
  re_coding: 5 * 60 * 1000,
  optimization: 3 * 60 * 1000,
  final_validation: 3 * 60 * 1000
}

/** Minimum LLM turns per phase (encourages continued thinking). */
export const MIN_TURNS_PER_PHASE: Record<AgentPhase, number> = {
  research: 10,
  planning: 8,
  implementation: 15,
  bug_detection: 8,
  code_review: 8,
  re_coding: 10,
  optimization: 7,
  final_validation: 7
}

export const MAX_TURNS_PER_PHASE: Record<AgentPhase, number> = {
  research: 40,
  planning: 25,
  implementation: 50,
  bug_detection: 35,
  code_review: 30,
  re_coding: 40,
  optimization: 30,
  final_validation: 30
}

/** Max tool calls allowed in one side-task beat (keeps beats short). */
export const MAX_SIDE_TOOL_CALLS = 2

/** Short breathe after a side beat completes (ms). */
export const SIDE_BEAT_BREATHE_MS = 2_500

/** Minimum characters in a reasoning block before we accept ending a turn. */
export const MIN_REASONING_CHARS: Record<AgentPhase, number> = {
  research: 1200,
  planning: 1500,
  implementation: 600,
  bug_detection: 800,
  code_review: 1000,
  re_coding: 600,
  optimization: 700,
  final_validation: 600
}

export const PHASES_WITHOUT_TOOLS: AgentPhase[] = ['planning']
