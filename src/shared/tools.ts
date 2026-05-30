import type { ToolDefinition } from './types'

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file in the project folder',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from project root' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a file in the project folder',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from project root' },
          content: { type: 'string', description: 'Full file content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command in the project folder',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information relevant to the task',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and folders in a directory within the project folder',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from project root, use "." for root' }
        },
        required: ['path']
      }
    }
  }
]
