import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { Task } from '../tasks/task.model.js';
import { TaskStatusEnum } from '../shared/enums/taskStatusEnum.js';
import { logTaskLifecycle } from '../shared/logging/task-lifecycle.js';
import { claimTask } from './task-claim.js';

export type ConverterFn = (input: Buffer, outputPath: string) => Promise<void>;

export type TaskProcessorOptions = {
    uploadsDirectory: string;
    resultsDirectory: string;
    claimsDirectory: string;
    converterFor: (task: Task) => ConverterFn;
    publishResult: (task: Task) => Promise<void>;
};

export type TaskProcessingResult = 'processed' | 'duplicate';

export async function processTask(
    task: Task,
    options: TaskProcessorOptions,
): Promise<TaskProcessingResult> {
    logTaskLifecycle('worker.task_received', task.task_id, {
        worker_pid: process.pid,
        worker_host: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'unknown',
    });

    let attempt = await claimTask(task.task_id, options.claimsDirectory);
    while (!attempt.acquired && attempt.reason === 'already_processing') {
        // Mantém a mensagem sem ACK até a conclusão ou recuperação do dono anterior.
        await setTimeout(100);
        attempt = await claimTask(task.task_id, options.claimsDirectory);
    }
    if (!attempt.acquired) {
        logTaskLifecycle('worker.duplicate_skipped', task.task_id, {
            reason: attempt.reason,
            worker_pid: process.pid,
        });
        return 'duplicate';
    }

    const { claim } = attempt;
    try {
        task.status = TaskStatusEnum.PROCESSING;
        task.timestamps = {
            criado_em: task.timestamps?.criado_em ?? new Date().toISOString(),
            iniciado_em: new Date().toISOString(),
            finalizado_em: null,
        };
        task.caminho_resultado = null;
        await options.publishResult(task);
        logTaskLifecycle('worker.processing_started', task.task_id, {
            worker_pid: process.pid,
        });

        const sourceExt = task.formato_origem.toLowerCase();
        const targetExt = task.formato_destino.toLowerCase();
        const inputPath = path.join(options.uploadsDirectory, `${task.task_id}.${sourceExt}`);
        const outputFileName = `${task.task_id}.${targetExt}`;
        const outputFullPath = path.join(options.resultsDirectory, outputFileName);

        try {
            const converter = options.converterFor(task);
            const file = await readFile(inputPath);
            await mkdir(options.resultsDirectory, { recursive: true });
            await converter(file, outputFullPath);

            task.status = TaskStatusEnum.COMPLETED;
            task.caminho_resultado = path.join('convertidos', outputFileName);
            logTaskLifecycle('worker.conversion_succeeded', task.task_id, {
                worker_pid: process.pid,
                output_file: outputFileName,
            });
        } catch (error) {
            task.status = TaskStatusEnum.FAILED;
            task.caminho_resultado = null;
            logTaskLifecycle('worker.conversion_failed', task.task_id, {
                worker_pid: process.pid,
                error: error instanceof Error ? error.message : String(error),
            }, 'error');
        }

        task.timestamps.finalizado_em = new Date().toISOString();
        await options.publishResult(task);
        logTaskLifecycle('worker.result_published', task.task_id, {
            worker_pid: process.pid,
            status: task.status,
        });
        await claim.complete();
        return 'processed';
    } catch (error) {
        logTaskLifecycle('worker.processing_interrupted', task.task_id, {
            worker_pid: process.pid,
            error: error instanceof Error ? error.message : String(error),
        }, 'error');
        await claim.release();
        throw error;
    }
}
