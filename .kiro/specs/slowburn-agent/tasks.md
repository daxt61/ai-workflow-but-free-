# Implementation Plan: SlowBurn Agent

## Overview

Implement the SlowBurn Electron desktop application in TypeScript using React for the UI, electron-vite as the build tool, and OpenRouter for LLM inference. The implementation follows the layered architecture defined in the design: main process handles all privileged operations, the preload script exposes a typed IPC bridge, and the renderer handles all UI. Tasks are ordered to build foundational infrastructure first, then the agent core, then the UI, and finally wire everything together.

## Tasks

- [ ] 1. Initialize Electron + TypeScript project structure
  - Scaffold the project using `electron-vite` with the React + TypeScript template
  - Configure `tsconfig.json` for main, preload, and renderer targets
  - Install core dependencies: `electron`, `electron-vite`, `react`, `react-dom`, `electron-store`, `node-pty`, `fast-check`, `vitest`
  - Install UI dependencies: `react-diff-viewer-continued`, `zustand`
  - Set up `vitest` configuration for unit and property tests
  - Create the directory structure: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`
  - _Requirements: 1.1, 4.1_

- [ ] 2. Implement shared types and data models
  - [ ] 2.1 Define all shared TypeScript interfaces in `src/shared/types.ts`
    - Implement `StartTaskParams`, `AppSettings`, `OpenRouterModel`, `AgentPhase`, `PhaseUpdate`, `LogEntry`, `LogEntryType`, `FileDiff`, `TaskResult`, `ApplyResult`, `ChatMessage`, `ShellResult`
    - Define the `AGENT_PHASES` constant array in fixed order: `['research', 'planning', 'implementation', 'bug_detection', 'code_review', 're_coding', 'optimization', 'final_validation']`
    - _Requirements: 5.1, 9.1, 11.1_

  - [ ] 2.2 Write property test for phase ordering constant
    - Verify `AGENT_PHASES` has exactly 8 elements in the correct order
    - **Property 4: Phase ordering invariant**
    - **Validates: Requirements 5.1**

- [ ] 3. Implement SettingsService
  - [ ] 3.1 Implement `src/main/services/SettingsService.ts`
    - Use `electron-store` for non-sensitive settings (`projectFolder`, `selectedModelId`, `searchProviderKey`, `windowBounds`)
    - Use `safeStorage.encryptString` / `safeStorage.decryptString` for the API key, stored as base64 in the electron-store file
    - Implement `getApiKey()`, `setApiKey(key)`, `getSettings()`, `saveSettings(partial)`, `reset()`
    - Handle corrupted store by catching schema validation errors and resetting to defaults
    - Fall back to base64 encoding if `safeStorage.isEncryptionAvailable()` returns false, with a console warning
    - _Requirements: 2.2, 13.1, 13.2, 13.3, 13.4, 14.4_

  - [ ] 3.2 Write property test for settings persistence round-trip
    - For any valid `AppSettings` object, `saveSettings` then `getSettings` must return an equivalent object
    - **Property 7: Settings persistence round-trip**
    - **Validates: Requirements 13.1**

  - [ ] 3.3 Write property test for API key opacity in settings
    - For any API key string, `getSettings()` must never return the raw key value
    - **Property 6: API key opacity**
    - **Validates: Requirements 14.4**

  - [ ] 3.4 Write unit tests for SettingsService
    - Test reset clears all values to defaults
    - Test corrupted store triggers reset and notification
    - Test `safeStorage` unavailable fallback
    - _Requirements: 13.3, 13.4_

- [ ] 4. Implement FileService
  - [ ] 4.1 Implement `src/main/services/FileService.ts`
    - Implement `validatePath(relativePath: string): string` using `path.resolve` and `path.normalize` to check the resolved path starts with the project folder's absolute path
    - Implement `readFile(relativePath)`, `writeFile(relativePath, content)`, `listDirectory(relativePath)`
    - Throw a `PathTraversalError` for any path that resolves outside the project folder
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 14.1_

  - [ ] 4.2 Write property test for path sandboxing
    - For any relative path string, `validatePath` must either return a path starting with the project folder or throw
    - For any path containing `../` sequences that escape the project folder, `validatePath` must throw
    - **Property 1: File path sandboxing**
    - **Validates: Requirements 6.3, 6.4, 14.1**

  - [ ] 4.3 Write property test for file read/write round-trip
    - For any content string and valid relative path, `writeFile` then `readFile` must return the same content
    - **Validates: Requirements 6.1, 6.2**

  - [ ] 4.4 Write unit tests for FileService
    - Test `listDirectory` returns correct entries
    - Test `readFile` on non-existent file returns descriptive error
    - _Requirements: 6.5_

- [ ] 5. Implement ShellService
  - [ ] 5.1 Implement `src/main/services/ShellService.ts`
    - Use `node-pty` to spawn shell commands with the project folder as the working directory (`cwd`)
    - Capture stdout and stderr, call `onOutput(line)` for each line as it arrives
    - Enforce the configurable timeout (default 120s) using `setTimeout` + `pty.kill()`
    - Return `ShellResult` with `exitCode`, `stdout`, `stderr`, `timedOut`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 5.2 Write property test for shell working directory
    - For any shell command that prints the working directory (e.g., `pwd`), the output must equal the project folder path
    - **Property 8: Shell command working directory**
    - **Validates: Requirements 7.1**

  - [ ] 5.3 Write unit tests for ShellService
    - Test timeout enforcement with a long-running command
    - Test non-zero exit code is captured in result
    - Test stdout and stderr are both captured
    - _Requirements: 7.2, 7.3, 7.4, 7.6_

- [ ] 6. Implement OpenRouterClient
  - [ ] 6.1 Implement `src/main/services/OpenRouterClient.ts`
    - Implement `chatCompletion(messages, tools?, signal?)` calling `POST https://openrouter.ai/api/v1/chat/completions`
    - Implement `listModels()` calling `GET https://openrouter.ai/api/v1/models`
    - Set `Authorization: Bearer {apiKey}` header on all requests
    - Implement exponential backoff retry (1s, 2s, 4s) for 429 and 5xx responses, up to 3 attempts
    - Set a 60-second request timeout using `AbortController`
    - Parse tool call responses from the OpenRouter response format
    - _Requirements: 3.1, 3.4_

  - [ ] 6.2 Write unit tests for OpenRouterClient
    - Mock HTTP responses using `msw` or `nock`
    - Test correct Authorization header is sent
    - Test retry logic on 429 and 5xx
    - Test timeout after 60 seconds
    - Test model list parsing
    - _Requirements: 3.1, 3.4_

- [ ] 7. Implement SearchService
  - [ ] 7.1 Implement `src/main/services/SearchService.ts`
    - Support Brave Search API (`https://api.search.brave.com/res/v1/web/search`) as the default provider
    - Accept the search API key from `SettingsService`
    - Return results as `{ title: string; url: string; snippet: string }[]`
    - On failure, return an empty array and log the error (do not throw)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 7.2 Write property test for search result shape
    - For any search result object returned by `SearchService`, it must contain non-empty `title`, `url`, and `snippet` fields
    - **Property: Web search result completeness**
    - **Validates: Requirements 8.2**

  - [ ] 7.3 Write unit tests for SearchService
    - Test graceful failure returns empty array and does not throw
    - Test result parsing from mock API response
    - _Requirements: 8.4_

- [ ] 8. Implement DiffTracker
  - [ ] 8.1 Implement `src/main/services/DiffTracker.ts`
    - Maintain a `Map<string, string | null>` of absolute path → original content (null for new files)
    - Implement `snapshotBeforeWrite(absolutePath)`: read current content before first write, store in map
    - Implement `computeDiffs(projectFolder)`: compare snapshots to current disk state, return `FileDiff[]`
    - Implement `applyAll()`: write all modified content to disk, return `ApplyResult` with any failed files
    - Implement `discardAll()`: restore all snapshotted files to their original content (delete new files)
    - Implement `reset()`: clear all snapshots
    - _Requirements: 6.6, 11.1, 11.3, 11.4, 11.5, 12.3_

  - [ ] 8.2 Write property test for diff discard round-trip
    - For any set of file writes tracked by DiffTracker, calling `discardAll()` must restore every file to its pre-write content
    - **Property 3: Diff round-trip consistency**
    - **Validates: Requirements 11.5, 12.3**

  - [ ] 8.3 Write property test for diff completeness
    - For any set of file writes tracked by DiffTracker, `computeDiffs()` must include every written file in the result
    - **Property: Diff completeness**
    - **Validates: Requirements 6.6, 11.1**

  - [ ] 8.4 Write unit tests for DiffTracker
    - Test `applyAll` writes correct content to disk
    - Test `applyAll` returns failed files on write error
    - Test `reset` clears all snapshots
    - _Requirements: 11.4, 11.6_

- [ ] 9. Implement CancellationToken
  - [ ] 9.1 Implement `src/main/agent/CancellationToken.ts`
    - Implement `cancel()`, `isCancelled` getter, `throwIfCancelled()`
    - Implement `CancellationError` class extending `Error`
    - _Requirements: 12.2_

- [ ] 10. Implement phase system prompts
  - [ ] 10.1 Implement `src/main/agent/phasePrompts.ts`
    - Define a `PHASE_PROMPTS` map from `AgentPhase` to system prompt string
    - Research prompt: instructs the LLM to use `web_search` (minimum 2 calls) and `list_directory`/`read_file` to understand the codebase and problem domain
    - Planning prompt: instructs the LLM to produce a numbered implementation plan without tool calls
    - Implementation prompt: instructs the LLM to execute the plan using `write_file`
    - Bug Detection prompt: instructs the LLM to read written files and run `run_command` for tests/linters
    - Code Review prompt: instructs the LLM to evaluate code quality and produce a review report
    - Re-Coding prompt: instructs the LLM to rewrite/refactor based on Bug Detection and Code Review findings
    - Optimization prompt: instructs the LLM to improve performance and code quality
    - Final Validation prompt: instructs the LLM to run all tests and checks via `run_command`
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

- [ ] 11. Implement ToolExecutor
  - [ ] 11.1 Implement `src/main/agent/ToolExecutor.ts`
    - Accept `FileService`, `ShellService`, `SearchService`, `DiffTracker`, and a log callback
    - Implement `execute(toolName, args)` that dispatches to the correct service
    - For `read_file`: call `FileService.readFile`, return content string
    - For `write_file`: call `DiffTracker.snapshotBeforeWrite` then `FileService.writeFile`, return success message
    - For `run_command`: call `ShellService.execute` with a line-by-line log callback, return formatted output
    - For `web_search`: call `SearchService.search`, return formatted results
    - For `list_directory`: call `FileService.listDirectory`, return formatted listing
    - Emit log entries for each tool call start and completion
    - _Requirements: 6.1, 6.2, 7.1, 8.1, 9.3, 9.4_

  - [ ] 11.2 Write unit tests for ToolExecutor
    - Test each tool dispatches to the correct service
    - Test log entries are emitted for tool call start and completion
    - Test `write_file` calls `snapshotBeforeWrite` before writing
    - _Requirements: 9.3, 9.4_

- [ ] 12. Implement PhaseRunner
  - [ ] 12.1 Implement `src/main/agent/PhaseRunner.ts`
    - Implement the agentic loop: call LLM → if tool calls present, execute each via `ToolExecutor` → append results to message history → repeat until no tool calls
    - Check `CancellationToken.throwIfCancelled()` before each LLM call and before each tool execution
    - Emit a `phase_header` log entry at the start of each phase
    - Emit a `reasoning` log entry for each LLM text response
    - Pass the phase-specific system prompt as the first message in each LLM call
    - Return the updated message history after the phase completes
    - _Requirements: 5.2, 5.3, 9.2, 9.5, 12.2_

  - [ ] 12.2 Write unit tests for PhaseRunner
    - Test phase header log entry is emitted at phase start
    - Test cancellation token is checked before each LLM call
    - Test tool call loop terminates when LLM returns no tool calls
    - Test message history is correctly extended after each phase
    - _Requirements: 5.2, 9.2, 12.2_

- [ ] 13. Implement AgentOrchestrator
  - [ ] 13.1 Implement `src/main/agent/AgentOrchestrator.ts`
    - Implement `runTask(params)`: iterate through `AGENT_PHASES` in order, calling `PhaseRunner.run` for each
    - Emit `phase:change` IPC events at each phase transition with correct `phaseIndex` and `totalPhases: 8`
    - Catch `CancellationError` to trigger cleanup: call `DiffTracker.discardAll()`, emit cancellation log entry, re-enable UI
    - Catch unrecoverable errors: log the error, emit `task:error` IPC event with descriptive message
    - On successful completion: call `DiffTracker.computeDiffs()`, emit `diff:ready` IPC event
    - Implement `cancel()`: call `cancellationToken.cancel()` and abort in-flight HTTP requests
    - _Requirements: 5.1, 5.2, 5.11, 11.1, 12.2, 12.3_

  - [ ] 13.2 Write property test for phase ordering
    - For any task run (with mocked LLM), the sequence of `phase:change` events must exactly match `AGENT_PHASES` in order
    - **Property 4: Phase ordering invariant**
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 13.3 Write unit tests for AgentOrchestrator
    - Test cancellation mid-task calls `discardAll` and emits cancellation log entry
    - Test unrecoverable error emits `task:error` event
    - Test successful completion emits `diff:ready` with computed diffs
    - _Requirements: 5.11, 12.2, 12.3_

- [ ] 14. Implement IPC handlers in main process
  - [ ] 14.1 Implement `src/main/ipc/handlers.ts`
    - Register `ipcMain.handle` for: `task:start`, `task:cancel`, `task:apply-diff`, `task:discard-diff`, `settings:get`, `settings:save`, `models:list`, `folder:select`
    - `task:start`: validate `description` is not whitespace-only, validate `projectFolder` exists, validate `modelId` is set, then call `AgentOrchestrator.runTask`
    - `task:cancel`: call `AgentOrchestrator.cancel()`
    - `task:apply-diff`: call `DiffTracker.applyAll()`
    - `task:discard-diff`: call `DiffTracker.discardAll()`
    - `settings:get`: return `SettingsService.getSettings()` (never include raw API key)
    - `settings:save`: call `SettingsService.saveSettings(partial)`; if `apiKey` is present, call `SettingsService.setApiKey`
    - `models:list`: call `OpenRouterClient.listModels()`
    - `folder:select`: open Electron `dialog.showOpenDialog` with `openDirectory` property
    - _Requirements: 2.4, 3.6, 4.2, 4.3, 4.4, 11.4, 11.5_

  - [ ] 14.2 Write property test for task description whitespace rejection
    - For any string composed entirely of whitespace characters, the `task:start` handler must reject it without starting the agent
    - **Property 2: Task description whitespace rejection**
    - **Validates: Requirements 4.2, 4.3**

  - [ ] 14.3 Write unit tests for IPC handlers
    - Test `settings:get` never returns the raw API key
    - Test `task:start` rejects missing model ID
    - Test `task:start` rejects missing project folder
    - _Requirements: 2.4, 3.6, 14.4_

- [ ] 15. Implement preload script
  - [ ] 15.1 Implement `src/preload/index.ts`
    - Use `contextBridge.exposeInMainWorld('slowburn', {...})` to expose the typed `SlowBurnAPI`
    - Expose invoke methods: `startTask`, `cancelTask`, `applyDiff`, `discardDiff`, `getSettings`, `saveSettings`, `listModels`, `selectFolder`
    - Expose event subscription methods: `onLogEntry(callback)`, `onPhaseChange(callback)`, `onTaskComplete(callback)`, `onTaskError(callback)`, `onDiffReady(callback)`
    - Each subscription method returns an unsubscribe function that calls `ipcRenderer.removeListener`
    - _Requirements: 9.1, 10.1_

- [ ] 16. Implement Zustand UI state store
  - [ ] 16.1 Implement `src/renderer/store/useAppStore.ts`
    - Define state: `taskStatus` (`idle | running | complete | failed | cancelled`), `currentPhase`, `phaseIndex`, `logEntries`, `diffs`, `settings`, `models`, `activeTaskDescription`
    - Define actions: `setTaskStatus`, `setPhase`, `appendLogEntry`, `setDiffs`, `setSettings`, `setModels`, `setActiveTaskDescription`
    - Subscribe to IPC events in a `useEffect` at app initialization: `onLogEntry → appendLogEntry`, `onPhaseChange → setPhase`, `onTaskComplete → setTaskStatus('complete')`, `onTaskError → setTaskStatus('failed')`, `onDiffReady → setDiffs`
    - _Requirements: 4.4, 4.5, 9.1, 10.1_

- [ ] 17. Implement Settings screen
  - [ ] 17.1 Implement `src/renderer/components/SettingsScreen.tsx`
    - Render an API key input field (type `password`) with a save button
    - Display masked API key (last 4 characters) when a key is already saved
    - Render a model selector dropdown that calls `listModels()` on open and displays model name + id
    - Render a project folder selector that calls `selectFolder()` and displays the selected path
    - Render a search provider API key input field
    - Render a "Reset Settings" button that calls `saveSettings({})` with empty values after confirmation
    - Show error messages for failed model list fetch
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 3.1, 3.2, 3.4, 8.3, 13.4_

  - [ ] 17.2 Write unit tests for SettingsScreen
    - Test API key input is masked after save
    - Test model dropdown renders model names and IDs
    - Test error message shown on model fetch failure
    - _Requirements: 2.3, 3.2, 3.4_

- [ ] 18. Implement Progress Bar component
  - [ ] 18.1 Implement `src/renderer/components/ProgressBar.tsx`
    - Display 8 phase indicators in a horizontal row
    - Highlight the current phase as active
    - Display "Phase N of 8: {phase name}" label
    - Show idle state when `taskStatus === 'idle'`
    - Show completed state (all phases filled) when `taskStatus === 'complete'`
    - Show failed state (error indicator on current phase) when `taskStatus === 'failed'`
    - Update within 500ms of receiving a `phase:change` event (driven by Zustand store)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 18.2 Write unit tests for ProgressBar
    - Test each of the 8 phases renders the correct phase name and index
    - Test idle, complete, and failed states render correctly
    - _Requirements: 10.3, 10.4, 10.5, 10.6_

- [ ] 19. Implement Log Panel component
  - [ ] 19.1 Implement `src/renderer/components/LogPanel.tsx`
    - Render a scrollable list of `LogEntry` items from the Zustand store
    - Style each entry type distinctly: `phase_header` (bold/colored), `tool_call` (indented, monospace), `tool_result` (indented, muted), `reasoning` (normal), `error` (red), `cancelled` (orange)
    - Implement collapse/expand toggle that hides/shows the entry list without affecting agent execution
    - Auto-scroll to the latest entry when expanded, unless the user has manually scrolled up (detect via scroll event listener)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 19.2 Write unit tests for LogPanel
    - Test collapse/expand toggle shows and hides entries
    - Test error entries render with error styling
    - Test phase header entries render with phase name
    - _Requirements: 9.6, 9.8_

- [ ] 20. Implement Task Input component
  - [ ] 20.1 Implement `src/renderer/components/TaskInput.tsx`
    - Render a multi-line textarea for task description
    - Render a model selector dropdown (populated from Zustand store)
    - Render a Submit button that calls `startTask` via the IPC bridge
    - Render a Cancel button (visible only when `taskStatus === 'running'`) that calls `cancelTask`
    - Disable textarea and Submit button when `taskStatus === 'running'`
    - Show inline validation error when task description is whitespace-only
    - Display the active task description while the agent is running
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.1, 12.5_

  - [ ] 20.2 Write unit tests for TaskInput
    - Test Submit button is disabled when task is running
    - Test Cancel button is visible only when task is running
    - Test whitespace-only description shows validation error and does not call `startTask`
    - _Requirements: 4.3, 4.4, 12.1_

- [ ] 21. Implement Diff View component
  - [ ] 21.1 Implement `src/renderer/components/DiffView.tsx`
    - Use `react-diff-viewer-continued` to render each `FileDiff` in unified diff format
    - Show added lines in green and removed lines in red
    - Display each file's relative path as a collapsible section header
    - Render Apply and Discard buttons that call `applyDiff()` and `discardDiff()` respectively
    - Show error message if `applyDiff()` returns failed files
    - Only render when `taskStatus === 'complete'` and `diffs` is non-empty
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 21.2 Write unit tests for DiffView
    - Test each file's relative path is displayed
    - Test Apply button calls `applyDiff`
    - Test Discard button calls `discardDiff`
    - Test error message shown when apply fails
    - _Requirements: 11.3, 11.4, 11.6_

- [ ] 22. Implement main App layout and wire all components
  - [ ] 22.1 Implement `src/renderer/App.tsx`
    - Compose `ProgressBar`, `TaskInput`, `LogPanel`, and `DiffView` into the main layout
    - Add a Settings button/icon that toggles the `SettingsScreen` overlay
    - Initialize the Zustand store's IPC event subscriptions on mount
    - Load settings from main process on startup via `getSettings()` and populate the store
    - Load models list on startup via `listModels()` and populate the store
    - Display the project folder path in the header
    - _Requirements: 1.1, 1.5, 2.1, 3.5, 13.2_

  - [ ] 22.2 Implement `src/main/index.ts` main process entry point
    - Create the `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and the preload script path
    - Instantiate all services: `SettingsService`, `FileService`, `ShellService`, `SearchService`, `OpenRouterClient`, `DiffTracker`
    - Instantiate `AgentOrchestrator` with all services
    - Register all IPC handlers from `handlers.ts`
    - Restore window bounds from settings on startup
    - Save window bounds to settings on close
    - _Requirements: 1.5, 13.1, 13.2, 14.1_

- [ ] 23. Checkpoint — Ensure all unit and property tests pass
  - Run `vitest --run` and verify all tests pass
  - Fix any failing tests before proceeding
  - Ensure all 8 correctness properties have corresponding property tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 24. Implement security hardening
  - [ ] 24.1 Audit all IPC handlers for input validation
    - Verify every file path argument is passed through `FileService.validatePath` before use
    - Verify no IPC handler returns the raw API key to the renderer
    - Add explicit checks for path traversal sequences (`../`, `..\\`) in shell command arguments
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [ ] 24.2 Write property test for log entry API key opacity
    - For any API key string and any log entry emitted during a task, the log entry content must not contain the raw API key
    - **Property 6: API key opacity**
    - **Validates: Requirements 14.4, 14.5**

  - [ ] 24.3 Write property test for shell command path traversal rejection
    - For any shell command string containing `../` sequences that would escape the project folder, the handler must reject it
    - **Property: Shell command sandboxing**
    - **Validates: Requirements 14.2**

- [ ] 25. Final checkpoint — Full integration verification
  - Run `vitest --run` to confirm all tests pass
  - Run `electron-vite build` to confirm the project builds without TypeScript errors
  - Verify the Electron app launches and the main window renders correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests use `fast-check` and validate universal correctness properties defined in the design document
- Unit tests use `vitest` and cover specific examples, edge cases, and error conditions
- The agent never runs in the renderer process — all LLM calls, file I/O, and shell execution happen in the main process
- The API key is never sent to the renderer process under any circumstances
