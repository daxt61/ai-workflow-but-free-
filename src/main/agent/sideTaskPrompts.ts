import type { AgentPhase } from '@shared/types'

export const SIDE_TASK_SYSTEM = `You are in a QUICK SIDE-TASK beat between main turns (about 1–3 minutes).

Rules:
- Do ONE small, useful action — not a full phase restart.
- Think out loud in 2–5 sentences first, then use tools if helpful.
- Good side tasks: clarify naming, add a short comment, fix a trivial bug, run lint/test on one path, re-read a file you may have misread, remove dead code, tighten types, improve error messages.
- Bad side tasks: large refactors, new features, rewriting entire files without need.
- If nothing useful to do, explain what you double-checked and why it's fine.`

/** Quick micro-tasks to run between main turns (rotated). */
export const SIDE_TASKS_BY_PHASE: Record<AgentPhase, string[]> = {
  research: [
    'Re-read one important file you skimmed; note conventions or dependencies you missed.',
    'web_search one narrow follow-up question based on what you learned so far.',
    'list_directory a folder you have not opened yet and summarize what lives there.',
    'Write down 3 edge cases or risks for the user task in bullet form.'
  ],
  planning: [
    'Review your plan: find one step that is vague and make it concrete (file paths, function names).',
    'List assumptions in your plan that might be wrong and how you would validate each.',
    'Add 2–3 verification steps to your plan that you had not written yet.',
    'Identify one rollback or safety check missing from the plan.'
  ],
  implementation: [
    'Pick one file you changed: improve clarity (names, small comment, structure) without changing behavior.',
    'run_command a quick lint, typecheck, or test scoped to what you just built (if the project has scripts).',
    'read_file a related file you did not read yet to ensure imports/APIs match.',
    'Fix one small issue you noticed (typo, missing null check, unclear variable).'
  ],
  bug_detection: [
    'run_command a focused test or lint command on the area you modified.',
    'read_file one changed file line-by-line looking for an off-by-one or null edge case.',
    'Think of one failure mode you have not tested yet; describe how to reproduce it.',
    'Check error handling paths in a file you wrote — are messages helpful?'
  ],
  code_review: [
    'Re-read one function for readability; note one rename or extract that would help (describe only, or fix if tiny).',
    'Check security: any user input, paths, or secrets handled unsafely?',
    'Check tests: is there a missing test case worth adding later?',
    'Compare your changes against the original user task — anything missing?'
  ],
  re_coding: [
    'Apply one small clarity fix while fixing review items (comment, rename, early return).',
    'read_file the file you just edited; confirm the fix matches the review note.',
    'run_command a quick verify command after your last fix.',
    'Remove leftover debug logging or commented-out code if you see any.'
  ],
  optimization: [
    'Simplify one overly complex branch without changing behavior.',
    'Remove duplication you noticed in the last files you touched.',
    'Check for unnecessary allocations or repeated work in a hot path (describe or fix if trivial).',
    'Improve one error message or type annotation for maintainability.'
  ],
  final_validation: [
    'run_command the fastest smoke test or build command available.',
    'Re-read the user task and check off each requirement mentally; note any gap.',
    'read_file the entry point of the feature you built to ensure the flow makes sense.',
    'List any known limitations the user should be aware of before shipping.'
  ]
}

export function pickSideTask(phase: AgentPhase, beatIndex: number): string {
  const pool = SIDE_TASKS_BY_PHASE[phase]
  return pool[beatIndex % pool.length]
}
