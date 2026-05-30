# Requirements Document

## Introduction

SlowBurn is an Electron desktop application that acts as a deliberate, multi-pass AI coding agent powered by OpenRouter. Unlike fast AI coding tools, SlowBurn intentionally spends 30–60 minutes per task by executing a structured sequence of phases: research, planning, initial implementation, bug detection, code review, re-coding, optimization, and final validation. The application provides a transparent, observable workflow where users can watch the agent reason, search the web, run commands, and iteratively improve code before presenting a final diff for user approval.

---

## Glossary

- **Agent**: The AI-driven orchestration system that executes multi-phase coding tasks using an LLM via OpenRouter.
- **Phase**: A discrete stage in the agent's workflow (e.g., Research, Planning, Implementation).
- **Task**: A single user-submitted coding prompt that the Agent processes end-to-end through all phases.
- **Project_Folder**: The user-selected directory on the local filesystem that the Agent reads from and writes to.
- **OpenRouter**: The third-party LLM API gateway used to access AI models.
- **Model**: An LLM available through OpenRouter that the Agent uses for all inference calls.
- **API_Key**: The user's OpenRouter authentication credential stored in application settings.
- **Log_Panel**: The expandable UI component that displays live step-by-step agent activity.
- **Diff_View**: The UI component that shows file changes produced by the Agent before the user applies them.
- **Tool_Call**: An action the Agent executes during a phase, such as reading a file, running a shell command, or performing a web search.
- **Settings**: The application configuration screen where the user manages the API_Key and other preferences.
- **Renderer**: The Electron renderer process responsible for the UI.
- **Main_Process**: The Electron main process responsible for filesystem access, shell execution, and IPC.
- **IPC**: Inter-process communication channel between the Renderer and Main_Process.
- **Web_Search**: A Tool_Call that queries a search engine to retrieve information relevant to the current Task.
- **Shell_Command**: A Tool_Call that executes a terminal command in the Project_Folder.

---

## Requirements

### Requirement 1: Project Folder Selection

**User Story:** As a developer, I want to select a project folder for the Agent to work in, so that the Agent reads and writes files in the correct codebase.

#### Acceptance Criteria

1. WHEN the application starts without a previously saved Project_Folder, THE Application SHALL display a prompt asking the user to select a Project_Folder.
2. WHEN the user selects a directory via the folder picker, THE Application SHALL store the selected path as the active Project_Folder and display it in the UI.
3. WHEN the user changes the Project_Folder, THE Application SHALL update all subsequent file operations to use the new path.
4. IF the selected path does not exist or is not accessible, THEN THE Application SHALL display an error message and retain the previous Project_Folder.
5. THE Application SHALL persist the Project_Folder path across application restarts.

---

### Requirement 2: OpenRouter API Key Management

**User Story:** As a developer, I want to enter and save my OpenRouter API key in settings, so that the Agent can authenticate with OpenRouter to make LLM calls.

#### Acceptance Criteria

1. THE Settings screen SHALL provide an input field for the user to enter the API_Key.
2. WHEN the user saves the API_Key, THE Application SHALL persist it securely using the operating system's credential store or encrypted local storage.
3. WHEN the API_Key is saved, THE Application SHALL mask the displayed value showing only the last four characters.
4. IF the API_Key is empty or missing when the user attempts to start a Task, THEN THE Application SHALL display an error directing the user to the Settings screen.
5. WHEN the user updates the API_Key, THE Application SHALL use the new value for all subsequent OpenRouter requests.

---

### Requirement 3: Model Selection

**User Story:** As a developer, I want to choose which OpenRouter model the Agent uses, so that I can balance cost, speed, and capability for my task.

#### Acceptance Criteria

1. WHEN the user opens the model selector, THE Application SHALL fetch the list of available models from the OpenRouter models API using the stored API_Key.
2. THE Model_Selector SHALL display each model's name and identifier in a dropdown list.
3. WHEN the user selects a Model, THE Application SHALL store the selection and use it for all LLM calls in the current and future Tasks until changed.
4. IF the OpenRouter models API request fails, THEN THE Application SHALL display an error message and allow the user to retry.
5. THE Application SHALL persist the selected Model across application restarts.
6. WHEN no Model has been selected and the user attempts to start a Task, THE Application SHALL display an error directing the user to select a Model.

---

### Requirement 4: Task Submission

**User Story:** As a developer, I want to submit a coding task as a natural language prompt, so that the Agent can work through it autonomously.

#### Acceptance Criteria

1. THE Task_Input SHALL provide a multi-line text area for the user to enter a Task description.
2. WHEN the user submits a Task, THE Application SHALL validate that the Task description is not composed entirely of whitespace before proceeding.
3. IF the Task description is empty or whitespace-only, THEN THE Application SHALL prevent submission and display a validation message.
4. WHEN a Task is actively running, THE Application SHALL disable the Task_Input and submission controls to prevent concurrent Task submissions.
5. WHEN a Task completes or is cancelled, THE Application SHALL re-enable the Task_Input and submission controls.
6. THE Application SHALL display the currently active Task description in the UI while the Agent is running.

---

### Requirement 5: Agent Phase Execution

**User Story:** As a developer, I want the Agent to execute a structured sequence of phases for each task, so that the code it produces is thoroughly researched, implemented, reviewed, and validated.

#### Acceptance Criteria

1. WHEN a Task is submitted, THE Agent SHALL execute phases in this fixed order: Research, Planning, Implementation, Bug_Detection, Code_Review, Re_Coding, Optimization, Final_Validation.
2. THE Agent SHALL complete each phase before advancing to the next phase.
3. WHEN executing the Research phase, THE Agent SHALL perform Web_Search Tool_Calls to gather information relevant to the Task.
4. WHEN executing the Planning phase, THE Agent SHALL produce a structured breakdown of implementation steps using LLM inference.
5. WHEN executing the Implementation phase, THE Agent SHALL write or modify files in the Project_Folder based on the plan.
6. WHEN executing the Bug_Detection phase, THE Agent SHALL analyze the written code and run Shell_Commands to identify defects.
7. WHEN executing the Code_Review phase, THE Agent SHALL evaluate code quality, patterns, and edge cases using LLM inference.
8. WHEN executing the Re_Coding phase, THE Agent SHALL rewrite or refactor files based on Bug_Detection and Code_Review findings.
9. WHEN executing the Optimization phase, THE Agent SHALL improve performance and code quality in the Project_Folder files.
10. WHEN executing the Final_Validation phase, THE Agent SHALL run Shell_Commands to verify the implementation is correct and all checks pass.
11. IF any phase encounters an unrecoverable error, THEN THE Agent SHALL log the error, halt execution, and notify the user with a descriptive message.

---

### Requirement 6: File System Tool Calls

**User Story:** As a developer, I want the Agent to read and write files in my project folder, so that it can understand the existing codebase and apply code changes.

#### Acceptance Criteria

1. WHEN the Agent needs to read a file, THE Main_Process SHALL read the file from the Project_Folder and return its contents to the Agent via IPC.
2. WHEN the Agent writes a file, THE Main_Process SHALL write the content to the specified path within the Project_Folder.
3. THE Agent SHALL restrict all file read and write operations to paths within the Project_Folder.
4. IF the Agent attempts to access a path outside the Project_Folder, THEN THE Main_Process SHALL reject the operation and return an error to the Agent.
5. WHEN the Agent lists directory contents, THE Main_Process SHALL return the file and folder names within the specified Project_Folder subdirectory.
6. THE Main_Process SHALL track all file modifications made during a Task and make them available for the Diff_View.

---

### Requirement 7: Shell Command Tool Calls

**User Story:** As a developer, I want the Agent to run terminal commands in my project folder, so that it can execute tests, install dependencies, and validate its work.

#### Acceptance Criteria

1. WHEN the Agent issues a Shell_Command, THE Main_Process SHALL execute it in the Project_Folder as the working directory.
2. THE Main_Process SHALL capture both stdout and stderr from each Shell_Command and return them to the Agent via IPC.
3. THE Main_Process SHALL enforce a configurable timeout on Shell_Command execution, defaulting to 120 seconds.
4. IF a Shell_Command exceeds the timeout, THEN THE Main_Process SHALL terminate the process and return a timeout error to the Agent.
5. THE Main_Process SHALL stream Shell_Command output to the Log_Panel in real time as lines are produced.
6. IF a Shell_Command exits with a non-zero exit code, THEN THE Agent SHALL treat the result as a failure and include the output in its analysis.

---

### Requirement 8: Web Search Tool Calls

**User Story:** As a developer, I want the Agent to search the web during the Research phase, so that it can gather up-to-date information before writing code.

#### Acceptance Criteria

1. WHEN the Agent performs a Web_Search, THE Application SHALL send the query to a configured search provider and return the results to the Agent.
2. THE Web_Search results SHALL include the page title, URL, and a text snippet for each result.
3. THE Application SHALL support configuring the search provider API key in Settings.
4. IF the Web_Search request fails, THEN THE Agent SHALL log the failure, skip the failed search, and continue execution.
5. THE Agent SHALL perform a minimum of two Web_Search Tool_Calls during the Research phase for each Task.
6. WHEN Web_Search results are received, THE Agent SHALL include the retrieved content in its LLM context for subsequent phases.

---

### Requirement 9: Live Log Panel

**User Story:** As a developer, I want to see a live log of every step the Agent takes, so that I can understand what it is doing and why.

#### Acceptance Criteria

1. THE Log_Panel SHALL display a chronological list of log entries as the Agent executes.
2. WHEN the Agent starts a new phase, THE Log_Panel SHALL display a phase header entry with the phase name and start timestamp.
3. WHEN the Agent makes a Tool_Call, THE Log_Panel SHALL display an entry showing the tool name and its input parameters.
4. WHEN a Tool_Call completes, THE Log_Panel SHALL display an entry showing the tool result or a summary of the output.
5. WHEN the Agent produces LLM reasoning or intermediate text, THE Log_Panel SHALL display it as a reasoning entry.
6. THE Log_Panel SHALL be collapsible and expandable without interrupting Agent execution.
7. THE Log_Panel SHALL automatically scroll to the latest entry while expanded, unless the user has manually scrolled up.
8. WHEN the Agent encounters an error, THE Log_Panel SHALL display the error with a visually distinct error style.

---

### Requirement 10: Progress Indicator

**User Story:** As a developer, I want to see a progress bar showing which phase the Agent is currently in, so that I know how far along the task is.

#### Acceptance Criteria

1. THE Progress_Bar SHALL display the current phase name and a visual indicator of progress through all eight phases.
2. WHEN the Agent advances to a new phase, THE Progress_Bar SHALL update to reflect the new current phase within 500 milliseconds.
3. THE Progress_Bar SHALL display the total number of phases and the index of the current phase (e.g., "Phase 3 of 8").
4. WHEN no Task is running, THE Progress_Bar SHALL display an idle state with no active phase highlighted.
5. WHEN a Task completes successfully, THE Progress_Bar SHALL display a completed state.
6. IF a Task fails, THE Progress_Bar SHALL display a failed state with a visual error indicator.

---

### Requirement 11: Diff View and Apply

**User Story:** As a developer, I want to review all file changes the Agent made before they are applied, so that I can approve or discard the results.

#### Acceptance Criteria

1. WHEN all phases complete successfully, THE Application SHALL display the Diff_View showing all files modified, created, or deleted by the Agent during the Task.
2. THE Diff_View SHALL show added lines in green and removed lines in red using a unified diff format.
3. THE Diff_View SHALL list each changed file with its relative path within the Project_Folder.
4. WHEN the user clicks Apply, THE Application SHALL write all Agent-produced file changes to the Project_Folder on disk.
5. WHEN the user clicks Discard, THE Application SHALL discard all Agent-produced file changes and restore the Project_Folder to its pre-Task state.
6. IF applying changes fails for any file, THEN THE Application SHALL display an error identifying the affected file and leave the remaining files unchanged.
7. THE Diff_View SHALL allow the user to expand and collapse individual file diffs.

---

### Requirement 12: Task Cancellation

**User Story:** As a developer, I want to cancel a running task at any time, so that I can stop the Agent if it is going in the wrong direction.

#### Acceptance Criteria

1. WHILE a Task is running, THE Application SHALL display a Cancel button.
2. WHEN the user clicks Cancel, THE Agent SHALL stop execution at the next safe checkpoint between Tool_Calls.
3. WHEN a Task is cancelled, THE Application SHALL discard all file changes made during the cancelled Task.
4. WHEN a Task is cancelled, THE Log_Panel SHALL display a cancellation entry with a timestamp.
5. WHEN a Task is cancelled, THE Application SHALL re-enable the Task_Input for a new submission.

---

### Requirement 13: Settings Persistence

**User Story:** As a developer, I want my settings to persist across application restarts, so that I do not have to reconfigure the application each time I open it.

#### Acceptance Criteria

1. THE Application SHALL persist the API_Key, selected Model, Project_Folder path, and search provider API key across restarts.
2. WHEN the application starts, THE Application SHALL load all persisted settings before rendering the main UI.
3. IF persisted settings are corrupted or unreadable, THEN THE Application SHALL reset to default values and notify the user.
4. THE Application SHALL provide a "Reset Settings" action in the Settings screen that clears all persisted values.

---

### Requirement 14: Security and Sandboxing

**User Story:** As a developer, I want the Agent's file and shell access to be restricted to my project folder, so that it cannot accidentally modify unrelated parts of my system.

#### Acceptance Criteria

1. THE Main_Process SHALL validate that every file path used in a Tool_Call resolves to a location within the Project_Folder before executing the operation.
2. THE Main_Process SHALL reject Shell_Commands that contain path traversal sequences (e.g., `../`) targeting locations outside the Project_Folder.
3. THE Application SHALL not transmit the contents of files outside the Project_Folder to the OpenRouter API.
4. THE Application SHALL store the API_Key only in the operating system credential store or an encrypted local file, never in plaintext application state or logs.
5. THE Log_Panel SHALL not display the API_Key value in any log entry.
