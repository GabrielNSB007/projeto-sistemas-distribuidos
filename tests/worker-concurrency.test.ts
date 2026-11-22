import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { claimTask } from '../src/worker/task-claim.js';

type LogEntry = {
    event?: string;
    task_id?: string | null;
    pid?: number;
    worker_pid?: number;
    status?: string;
    timestamp?: string;
};

function runWorkerProcess(
    fixturePath: string,
    workingDirectory: string,
    arguments_: string[],
): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fixturePath, ...arguments_], {
            cwd: workingDirectory,
            windowsHide: true,
        });
        let output = '';
        let errorOutput = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => { output += chunk; });
        child.stderr.on('data', (chunk: string) => { errorOutput += chunk; });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker de teste encerrou com código ${code}:\n${errorOutput}\n${output}`));
                return;
            }

            try {
                resolve(output.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as LogEntry));
            } catch (error) {
                reject(new Error(`Saída de Worker não estruturada:\n${output}\n${String(error)}`));
            }
        });
    });
}

test('workers de processos distintos processam uma vez por tarefa e isolam saídas', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-worker-concurrency-'));
    const uploadsDirectory = path.join(root, 'uploads');
    const resultsDirectory = path.join(root, 'convertidos');
    const claimsDirectory = path.join(root, 'claims');
    const fixturePath = path.resolve('tests/fixtures/worker-process.ts');
    const taskIds = [randomUUID(), randomUUID()];

    await Promise.all([
        mkdir(uploadsDirectory, { recursive: true }),
        mkdir(resultsDirectory, { recursive: true }),
        mkdir(claimsDirectory, { recursive: true }),
    ]);

    try {
        await Promise.all(taskIds.map((taskId) =>
            writeFile(path.join(uploadsDirectory, `${taskId}.txt`), `input:${taskId}`),
        ));

        const argumentsFor = (taskId: string) => [
            uploadsDirectory,
            resultsDirectory,
            claimsDirectory,
            taskId,
            '400',
        ];
        const settledResults = await Promise.all([
            runWorkerProcess(fixturePath, process.cwd(), argumentsFor(taskIds[0]!)),
            runWorkerProcess(fixturePath, process.cwd(), argumentsFor(taskIds[0]!)),
            runWorkerProcess(fixturePath, process.cwd(), argumentsFor(taskIds[1]!)),
            runWorkerProcess(fixturePath, process.cwd(), argumentsFor(taskIds[1]!)),
        ].map((result) => result.then(
            (value) => ({ value }),
            (error: unknown) => ({ error }),
        )));
        const failure = settledResults.find((result) => 'error' in result);
        if (failure && 'error' in failure) throw failure.error;
        const results = settledResults.map((result) => {
            if ('value' in result) return result.value;
            throw result.error;
        });
        const logs = results.flat();

        for (const taskId of taskIds) {
            const starts = logs.filter((entry) =>
                entry.event === 'worker.processing_started' && entry.task_id === taskId,
            );
            const completions = logs.filter((entry) =>
                entry.event === 'worker.conversion_succeeded' && entry.task_id === taskId,
            );
            const output = await readFile(
                path.join(resultsDirectory, `${taskId}.pdf`),
                'utf8',
            );

            assert.equal(starts.length, 1, `task ${taskId} deve iniciar em somente um Worker`);
            assert.equal(completions.length, 1, `task ${taskId} deve converter somente uma vez`);
            assert.equal(output, `converted:input:${taskId}`, 'a saída deve corresponder à entrada da própria tarefa');
        }

        const winners = taskIds.map((taskId) =>
            logs.find((entry) => entry.event === 'worker.processing_started' && entry.task_id === taskId),
        );
        assert.notEqual(winners[0]?.worker_pid, winners[1]?.worker_pid);

        const processingIntervals = taskIds.map((taskId) => {
            const started = logs.find((entry) =>
                entry.event === 'worker.processing_started' && entry.task_id === taskId,
            );
            const completed = logs.find((entry) =>
                entry.event === 'worker.conversion_succeeded' && entry.task_id === taskId,
            );
            assert.ok(started?.timestamp && completed?.timestamp);
            return [Date.parse(started.timestamp), Date.parse(completed.timestamp)];
        });
        assert.ok(
            Math.max(...processingIntervals.map(([started]) => started!)) <
                Math.min(...processingIntervals.map(([, completed]) => completed!)),
            'tarefas distintas devem se sobrepor temporalmente em processos concorrentes',
        );

        const duplicateSkips = logs.filter((entry) => entry.event === 'worker.duplicate_skipped');
        assert.equal(duplicateSkips.length, 2, 'mensagens duplicadas devem ser ignoradas');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('revalida conclusão depois de adquirir o lock', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-lock-race-'));
    const taskId = randomUUID();
    const first = await claimTask(taskId, root);
    assert.ok(first.acquired);
    const originalOpen = fsPromises.open;
    const originalLink = fsPromises.link;
    let reached!: () => void;
    let resume!: () => void;
    const ready = new Promise<void>((resolve) => { reached = resolve; });
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    const pause = async (filePath: unknown) => {
        if (String(filePath).endsWith('.lock')) {
            reached();
            await gate;
        }
    };
    fsPromises.open = async (...args) => {
        await pause(args[0]);
        return originalOpen(...args);
    };
    fsPromises.link = async (...args) => {
        await pause(args[1]);
        return originalLink(...args);
    };
    syncBuiltinESMExports();
    try {
        const second = claimTask(taskId, root);
        await ready;
        await first.claim.complete();
        resume();
        const result = await second;
        if (result.acquired) await result.claim.release();
        assert.deepEqual(result, { acquired: false, reason: 'already_completed' });
    } finally {
        resume();
        fsPromises.open = originalOpen;
        fsPromises.link = originalLink;
        syncBuiltinESMExports();
        await rm(root, { recursive: true, force: true });
    }
});

test('workers concorrentes recuperam lock de processo encerrado sem duplicar conversão', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-lock-recovery-'));
    const uploads = path.join(root, 'uploads');
    const results = path.join(root, 'convertidos');
    const claims = path.join(root, 'claims');
    const taskId = randomUUID();
    try {
        await mkdir(uploads);
        await writeFile(path.join(uploads, `${taskId}.txt`), 'recovery');
        await runWorkerProcess(path.resolve('tests/fixtures/claim-process.ts'), process.cwd(), [claims, taskId]);
        const args = [uploads, results, claims, taskId, '400'];
        const processes = await Promise.allSettled(Array.from({ length: 4 }, () =>
            runWorkerProcess(path.resolve('tests/fixtures/worker-process.ts'), process.cwd(), args),
        ));
        const logs = processes.flatMap((result) => {
            if (result.status === 'rejected') throw result.reason;
            return result.value;
        });
        assert.equal(logs.filter((entry) => entry.event === 'worker.processing_started').length, 1);
        assert.equal(logs.filter((entry) => entry.event === 'worker.conversion_succeeded').length, 1);
        assert.equal(await readFile(path.join(results, `${taskId}.pdf`), 'utf8'), 'converted:recovery');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('mensagem com lock ativo aguarda em vez de ser confirmada como duplicata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-lock-wait-'));
    const uploads = path.join(root, 'uploads');
    const results = path.join(root, 'convertidos');
    const claims = path.join(root, 'claims');
    const taskId = randomUUID();
    await mkdir(uploads);
    await writeFile(path.join(uploads, `${taskId}.txt`), 'waiting');
    const owner = await claimTask(taskId, claims);
    assert.ok(owner.acquired);
    let finished = false;
    const pending = runWorkerProcess(path.resolve('tests/fixtures/worker-process.ts'), process.cwd(),
        [uploads, results, claims, taskId, '50']);
    void pending.then(() => { finished = true; }, () => { finished = true; });
    try {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const returnedWhileLocked = finished;
        await owner.claim.release();
        const logs = await pending;
        assert.equal(returnedWhileLocked, false);
        assert.equal(logs.filter((entry) => entry.event === 'worker.conversion_succeeded').length, 1);
    } finally {
        await owner.claim.release();
        await pending.catch(() => {});
        await rm(root, { recursive: true, force: true });
    }
});
