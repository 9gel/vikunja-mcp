import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { moveTaskToBucket } from '../../src/tools/tasks/move-to-bucket';
import type { AuthManager } from '../../src/auth/AuthManager';
import { MCPError } from '../../src/types';

describe('moveTaskToBucket', () => {
  const authManager = {
    getSession: jest.fn().mockReturnValue({
      apiUrl: 'https://vikunja.example/api/v1',
      apiToken: 'token',
    }),
  } as unknown as AuthManager;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the task id to the Vikunja bucket endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ task_id: 42, bucket_id: 9 }), { status: 200 }),
    );

    const result = await moveTaskToBucket(
      { taskId: 42, projectId: 3, viewId: 7, bucketId: 9 },
      authManager,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://vikunja.example/api/v1/projects/3/views/7/buckets/9/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        body: JSON.stringify({ task_id: 42 }),
      }),
    );
    expect(result.content[0]?.text).toContain('Task 42 moved to bucket 9');
  });

  it('rejects incomplete identifiers before making an API request', async () => {
    try {
      await moveTaskToBucket({ taskId: 42, projectId: 3, viewId: 7 }, authManager);
      throw new Error('Expected moveTaskToBucket to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(MCPError);
      expect(error).toHaveProperty('message', expect.stringContaining('bucketId is required'));
    }
  });
});
