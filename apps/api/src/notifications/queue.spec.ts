import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

describe('notification queue', () => {
  it('delivers a job through BullMQ and Redis', async () => {
    const name = `hiihive-test-${randomUUID()}`;
    const connection = new Redis('redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
    const delivered: string[] = [];
    const worker = new Worker(
      name,
      async (job) => {
        delivered.push(String(job.data.id));
      },
      { connection: connection.duplicate() },
    );
    const queue = new Queue(name, { connection });
    await queue.add('deliver', { id: 'notice-1' });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('queue job was not processed')), 8000);
      worker.on('completed', () => {
        clearTimeout(timer);
        resolve();
      });
      worker.on('failed', (job, error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    expect(delivered).toEqual(['notice-1']);
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  });
});
