import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type ClaimRecord = {
    task_id: string;
    token: string;
    pid: number;
    hostname: string;
    claimed_at: string;
};

export type TaskClaim = {
    complete(): Promise<void>;
    release(): Promise<void>;
};

export type ClaimAttempt =
    | { acquired: true; claim: TaskClaim }
    | { acquired: false; reason: 'already_processing' | 'already_completed' };

function getTaskKey(taskId: string): string {
    return createHash('sha256').update(taskId).digest('hex');
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await readFile(filePath);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
    }
}

export async function claimTask(taskId: string, claimsDirectory: string): Promise<ClaimAttempt> {
    await mkdir(claimsDirectory, { recursive: true });

    const key = getTaskKey(taskId);
    const claimPath = path.join(claimsDirectory, `${key}.lock`);
    const completedPath = path.join(claimsDirectory, `${key}.done`);

    if (await exists(completedPath)) {
        return { acquired: false, reason: 'already_completed' };
    }

    const token = randomUUID();
    const record: ClaimRecord = {
        task_id: taskId,
        token,
        pid: process.pid,
        hostname: os.hostname(),
        claimed_at: new Date().toISOString(),
    };

    let handle;
    try {
        handle = await open(claimPath, 'wx');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            return { acquired: false, reason: 'already_processing' };
        }
        throw error;
    }

    try {
        await handle.writeFile(JSON.stringify(record));
    } catch (error) {
        await handle.close();
        await unlink(claimPath);
        throw error;
    }
    await handle.close();

    let released = false;
    const release = async (): Promise<void> => {
        if (released) return;

        const currentRecord: ClaimRecord = JSON.parse(await readFile(claimPath, 'utf8'));
        if (currentRecord.token !== token) {
            throw new Error(`A reivindicação da tarefa ${taskId} mudou inesperadamente.`);
        }

        await unlink(claimPath);
        released = true;
    };

    return {
        acquired: true,
        claim: {
            release,
            async complete(): Promise<void> {
                let completedHandle;
                try {
                    completedHandle = await open(completedPath, 'wx');
                    await completedHandle.writeFile(JSON.stringify({
                        task_id: taskId,
                        completed_at: new Date().toISOString(),
                    }));
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                        throw error;
                    }
                } finally {
                    await completedHandle?.close();
                }

                await release();
            },
        },
    };
}
