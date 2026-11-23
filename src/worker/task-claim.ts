import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, readFile, unlink, writeFile, link } from 'node:fs/promises';
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

function ownerHasExited(record: ClaimRecord): boolean {
    if (record.hostname !== os.hostname() || !Number.isInteger(record.pid) || record.pid <= 0) {
        return false;
    }
    try {
        process.kill(record.pid, 0);
        return false;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
}

async function acquireLock(lockPath: string, recordPath: string): Promise<boolean> {
    for (;;) {
        try {
            // O registro completo fica visível atomicamente, sem janela de lock vazio.
            await link(recordPath, lockPath);
            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }

        let previous: ClaimRecord;
        try {
            previous = JSON.parse(await readFile(lockPath, 'utf8'));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
            throw error;
        }
        if (!ownerHasExited(previous)) return false;

        // Serializa a recuperação deste dono; um recuperador encerrado também é recuperável.
        const recoveryPath = `${lockPath}.${getTaskKey(previous.token)}.recovery`;
        if (!await acquireLock(recoveryPath, recordPath)) return false;
        try {
            try {
                const current: ClaimRecord = JSON.parse(await readFile(lockPath, 'utf8'));
                if (current.token === previous.token) await unlink(lockPath);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        } finally {
            await unlink(recoveryPath);
        }
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

    const recordPath = path.join(claimsDirectory, `${token}.claim`);
    await writeFile(recordPath, JSON.stringify(record), { flag: 'wx' });
    try {
        if (!await acquireLock(claimPath, recordPath)) {
            return { acquired: false, reason: 'already_processing' };
        }
    } finally {
        await unlink(recordPath);
    }

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

    if (await exists(completedPath)) {
        await release();
        return { acquired: false, reason: 'already_completed' };
    }

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
