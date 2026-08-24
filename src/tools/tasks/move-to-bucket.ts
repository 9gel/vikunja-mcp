/**
 * Move a task to a Kanban bucket.
 *
 * node-vikunja does not expose Vikunja's task-bucket endpoint, so this uses
 * the same authenticated API URL and token as the client factory directly.
 */

import { MCPError, ErrorCode } from '../../types';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../../auth/AuthManager';
import { handleFetchError, handleStatusCodeError } from '../../utils/error-handler';
import { validateId } from './validation';
import { createSuccessResponse, formatMcpResponse } from '../../utils/simple-response';

export interface MoveTaskToBucketArgs {
  taskId?: number;
  projectId?: number;
  viewId?: number;
  bucketId?: number;
  sessionId?: string;
}

interface TaskBucketResponse {
  task_id?: number;
  bucket_id?: number;
  project_view_id?: number;
  task?: unknown;
}

function requireId(value: number | undefined, name: string): number {
  if (value === undefined) {
    throw new MCPError(ErrorCode.VALIDATION_ERROR, `${name} is required to move a task to a bucket`);
  }
  validateId(value, name);
  return value;
}

/** Move a task into a bucket in a project view. */
export async function moveTaskToBucket(
  args: MoveTaskToBucketArgs,
  authManager: AuthManager,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const taskId = requireId(args.taskId, 'taskId');
  const projectId = requireId(args.projectId, 'projectId');
  const viewId = requireId(args.viewId, 'viewId');
  const bucketId = requireId(args.bucketId, 'bucketId');

  try {
    const session = authManager.getSession();
    const response = await fetch(
      `${session.apiUrl}/projects/${projectId}/views/${viewId}/buckets/${bucketId}/tasks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw handleStatusCodeError(
        { statusCode: response.status, message: errorText },
        'move task to bucket',
        taskId,
        `Failed to move task ${taskId} to bucket ${bucketId}: ${errorText}`,
      );
    }

    const moved = (await response.json()) as TaskBucketResponse;
    const result = createSuccessResponse(
      'move-task-to-bucket',
      `Task ${taskId} moved to bucket ${bucketId}`,
      { movedTask: moved },
      { taskId, projectId, viewId, bucketId },
    );

    return { content: formatMcpResponse(result) };
  } catch (error) {
    if (error instanceof MCPError) throw error;
    if (error instanceof Error && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND'))) {
      throw handleFetchError(error, 'move task to bucket');
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to move task ${taskId} to bucket ${bucketId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Register the focused task move tool. */
export function registerTaskMoveTool(
  server: McpServer,
  authManager: AuthManager,
): void {
  server.tool(
    'vikunja_task_move_to_bucket',
    'Move a task to a Kanban bucket in a project view',
    {
      taskId: z.number().int().positive(),
      projectId: z.number().int().positive(),
      viewId: z.number().int().positive(),
      bucketId: z.number().int().positive(),
    },
    async (args: MoveTaskToBucketArgs) => {
      if (!authManager.isAuthenticated()) {
        throw new MCPError(ErrorCode.AUTH_REQUIRED, 'Authentication required. Please use vikunja_auth.connect first.');
      }
      return moveTaskToBucket(args, authManager);
    },
  );
}
