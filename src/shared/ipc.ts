export const IPC = {
  TASK_START: 'task:start',
  TASK_CANCEL: 'task:cancel',
  TASK_APPLY_DIFF: 'task:apply-diff',
  TASK_DISCARD_DIFF: 'task:discard-diff',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  MODELS_LIST: 'models:list',
  FOLDER_SELECT: 'folder:select',
  LOG_ENTRY: 'log:entry',
  PHASE_CHANGE: 'phase:change',
  TASK_COMPLETE: 'task:complete',
  TASK_ERROR: 'task:error',
  DIFF_READY: 'diff:ready'
} as const
