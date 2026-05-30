# Requirements Document

## Introduction

The Deep Coding Agent is an Electron desktop application (JavaScript/TypeScript) that acts as a slow, thorough AI coding assistant. Unlike fast-turnaround agents, it is designed to spend 30 minutes to an hour per task, performing multiple structured passes — research, initial coding, bug fixing, code review, re-analysis, recoding, and optimization — before presenting the user with a diff of all proposed changes for manual approval. The agent uses the OpenRouter API, allowing the user to select from available AI models. It can read and write files in a user-selected project folder, execute terminal commands, and perform web searches to research solutions before coding.

---

## Glossary

- **Agent**: The automated multi-phase AI coding pipeline that processes a single user task from start to finish.
- **App**: The Deep Coding Agent Electron desktop application.
- **OpenRouter_API**: The third-party API service (openrouter.ai) used to route requests to various AI models.
- **API_Key**: The user-provided OpenRouter API key stored in app settings.
- **Model**: An AI language model available through the OpenRouter_API, selectable by the user.
- **Task**: A single user-submitted natural language prompt describing a coding objective.
- **Phase**: One discrete step in the Agent's multi-pass pipeline (Research, Initial Code, Bug Fix, Code Review, Re-analyze, Recode, Optimize).
- **Project_Folder**: A user-selected directory on the local filesystem that the Agent is authorized to read from and write to.
- **Diff**: A structured, human-readable representation of all file changes proposed by the Agent after completing all phases.
- **Log_Panel**: An expandable UI panel that displays a live, timestamped log of each Agent action as it occurs.
- **Progress_Bar**: A UI component that displays the current Phase label and overall progress through the pipeline.
- **Settings**: The persistent application configuration screen where the user manages the API_Key and other preferences.
- **Terminal_Command**: A shell command executed by the Agent within the Project_Folder (e.g., `npm install`, test runners, build scripts).
- **Web_Search**: An internet search performed by the Agent during the Research phase to gather information relevant to the Task.

---

## Requirements

### Requirement 1: Single-Task Execution Model

**User Story:** As a user, I want the Agent to focus on one task at a time, so that it can apply maximum thoroughness without context switching.

#### Acceptance Criteria

1. THE App SHALL accept exactly one Task at a time.
2. WHILE the Agent is processing a Task, THE App SHALL disable the task submission input and prevent new Task submissions.
3. WHEN the Agent completes all phases for a Task, THE App SHALL re-enable the task submission input.
4. IF the user attempts to submit a new Task while the Agent is processing, THEN THE App SHALL display a message indicating that the Agent is busy and a new Task cannot be accepted until the current one is complete.

---

### Requirement 2: Multi-Phase Agent Pipeline

**User Story:** As a user, I want the Agent to work through a structured series of phases, so that the final code output is thoroughly researched, implemented, reviewed, and optimized.

#### Acceptance Criteria

1. WHEN a Task is submitted, THE Agent SHALL execute phases in the following fixed order: Research → Initial Code → Bug Fix → Code Review → Re-analyze → Recode → Optimize.
2. THE Agent SHALL complete each Phase fully before advancing to the next Phase.
3. WHEN all phases are complete, THE Agent SHALL present the Diff to the user for review.
4. THE Agent SHALL spend a cumulative duration of between 30 and 60 minutes processing a Task across all phases.
5. IF a Phase produces an error that prevents continuation, THEN THE Agent SHALL log the error in the Log_Panel and halt the pipeline, notifying the user of the failure and the Phase at which it occurred.

---

### Requirement 3: Research Phase

**User Story:** As a user, I want the Agent to research relevant information before writing code, so that its implementation is informed by current best practices and documentation.

#### Acceptance Criteria

1. WHEN the Research phase begins, THE Agent SHALL analyze the Task to identify topics, libraries, APIs, or patterns that require investigation.
2. WHEN a research topic is identified, THE Agent SHALL perform one or more Web_Searches to gather relevant information.
3. THE Agent SHALL log each Web_Search query and a summary of findings in the Log_Panel.
4. WHEN the Research phase is complete, THE Agent SHALL produce a structured research summary that informs subsequent phases.

---

### Requirement 4: File Read and Write Access

**User Story:** As a user, I want the Agent to read and modify files in my project, so that it can understand the existing codebase and apply changes.

#### Acceptance Criteria

1. WHEN the user selects a Project_Folder, THE App SHALL grant the Agent read and write access exclusively to files within that Project_Folder.
2. THE Agent SHALL read existing files in the Project_Folder to understand the codebase context before generating or modifying code.
3. WHEN the Agent proposes file changes, THE App SHALL stage those changes internally and NOT write them to disk until the user approves the Diff.
4. IF the Agent attempts to access a path outside the Project_Folder, THEN THE App SHALL deny the access and log a security warning in the Log_Panel.

---

### Requirement 5: Terminal Command Execution

**User Story:** As a user, I want the Agent to run terminal commands in my project folder, so that it can install dependencies, run tests, and build the project as part of its workflow.

#### Acceptance Criteria

1. THE Agent SHALL execute Terminal_Commands within the Project_Folder during any Phase where command execution is required (e.g., installing dependencies, running tests, building).
2. WHEN a Terminal_Command is executed, THE Agent SHALL log the command and its output in the Log_Panel.
3. IF a Terminal_Command exits with a non-zero exit code, THEN THE Agent SHALL log the failure and use the output to inform the next corrective action within the current or subsequent Phase.
4. THE Agent SHALL execute Terminal_Commands only within the Project_Folder and SHALL NOT execute commands that modify the host system outside the Project_Folder.

---

### Requirement 6: Progress Visibility

**User Story:** As a user, I want to see what the Agent is doing at all times, so that I can follow its progress and understand how it is spending its time.

#### Acceptance Criteria

1. THE App SHALL display a Progress_Bar that shows the current Phase name and the Agent's position within the overall pipeline.
2. WHEN the Agent advances to a new Phase, THE Progress_Bar SHALL update to reflect the new Phase label.
3. THE App SHALL display a Log_Panel that shows a live, timestamped record of each action the Agent takes.
4. WHEN the Agent performs an action (Web_Search, file read, file write, Terminal_Command execution, AI model call), THE Log_Panel SHALL append a new entry describing that action within 2 seconds of the action occurring.
5. THE Log_Panel SHALL be collapsible and expandable by the user without interrupting Agent execution.

---

### Requirement 7: Diff Review and Manual Apply

**User Story:** As a user, I want to review all proposed file changes before they are applied, so that I remain in control of what gets written to my project.

#### Acceptance Criteria

1. WHEN the Agent completes all phases, THE App SHALL display a Diff view showing all proposed additions, deletions, and modifications across all affected files in the Project_Folder.
2. THE Diff view SHALL present changes on a per-file basis, with the filename and change summary visible for each file.
3. WHEN the user approves the Diff, THE App SHALL write all staged changes to the Project_Folder.
4. WHEN the user rejects the Diff, THE App SHALL discard all staged changes and leave the Project_Folder unmodified.
5. THE App SHALL NOT write any file changes to the Project_Folder before the user explicitly approves the Diff.

---

### Requirement 8: Model Selection

**User Story:** As a user, I want to choose which AI model the Agent uses, so that I can balance cost, speed, and capability for each task.

#### Acceptance Criteria

1. THE App SHALL display a model selection dropdown populated with the list of models available through the OpenRouter_API for the user's API_Key.
2. WHEN the user selects a Model, THE App SHALL use that Model for all AI calls made during the subsequent Task.
3. WHEN the App is launched and a valid API_Key is present, THE App SHALL fetch the available model list from the OpenRouter_API and populate the dropdown.
4. IF the OpenRouter_API returns an error when fetching the model list, THEN THE App SHALL display an error message and allow the user to retry.
5. THE App SHALL persist the user's last selected Model across sessions.

---

### Requirement 9: API Key Management

**User Story:** As a user, I want to provide and store my own OpenRouter API key, so that I control my own usage and billing.

#### Acceptance Criteria

1. THE Settings screen SHALL provide an input field for the user to enter their API_Key.
2. WHEN the user saves the API_Key, THE App SHALL store it in the operating system's secure credential store.
3. THE App SHALL NOT display the full API_Key value after it has been saved; THE App SHALL display only a masked representation (e.g., the first 4 and last 4 characters).
4. WHEN the Agent makes a request to the OpenRouter_API, THE App SHALL retrieve the API_Key from the secure credential store and include it in the request authorization header.
5. IF no API_Key is configured, THEN THE App SHALL prompt the user to enter one before allowing Task submission.
6. WHEN the user removes the API_Key from Settings, THE App SHALL delete it from the secure credential store.

---

### Requirement 10: Project Folder Selection

**User Story:** As a user, I want to select which project folder the Agent works in, so that I can point it at any codebase on my machine.

#### Acceptance Criteria

1. THE App SHALL provide a folder picker control that allows the user to select a Project_Folder from the local filesystem.
2. WHEN a Project_Folder is selected, THE App SHALL display the selected path in the UI.
3. THE App SHALL persist the last selected Project_Folder path across sessions.
4. IF the previously persisted Project_Folder path no longer exists on the filesystem at launch, THEN THE App SHALL notify the user and prompt them to select a new Project_Folder.
5. THE Agent SHALL NOT begin Task processing if no Project_Folder has been selected; THE App SHALL prompt the user to select one.

---

### Requirement 11: Application Settings Persistence

**User Story:** As a user, I want my preferences to be saved between sessions, so that I do not have to reconfigure the app each time I open it.

#### Acceptance Criteria

1. THE App SHALL persist the following settings across sessions: selected Model, Project_Folder path, and Log_Panel expanded/collapsed state.
2. WHEN the App is launched, THE App SHALL restore all persisted settings to their last saved values.
3. WHEN a setting is changed by the user, THE App SHALL persist the new value immediately without requiring a manual save action.
