import { writeFile } from 'node:fs/promises';
import { FileFormatEnum } from '../../src/shared/enums/fileFormatEnum.js';
import { TaskStatusEnum } from '../../src/shared/enums/taskStatusEnum.js';
import type { Task } from '../../src/tasks/task.model.js';
import { processTask } from '../../src/worker/task-processor.js';

const [uploadsDirectory, resultsDirectory, claimsDirectory, taskId, delay] = process.argv.slice(2);
if (!uploadsDirectory || !resultsDirectory || !claimsDirectory || !taskId || !delay) {
    throw new Error('Argumentos insuficientes para o processo Worker de teste.');
}

const task: Task = {
    task_id: taskId,
    nome_arquivo: `${taskId}.txt`,
    formato_origem: FileFormatEnum.TXT,
    formato_destino: FileFormatEnum.PDF,
    status: TaskStatusEnum.PENDING,
    timestamps: {
        criado_em: new Date().toISOString(),
        iniciado_em: null,
        finalizado_em: null,
    },
    caminho_resultado: null,
};

const outcome = await processTask(task, {
    uploadsDirectory,
    resultsDirectory,
    claimsDirectory,
    converterFor: () => async (input, outputPath) => {
        await new Promise((resolve) => setTimeout(resolve, Number(delay)));
        await writeFile(outputPath, `converted:${input.toString('utf8')}`);
    },
    publishResult: async () => {},
});

console.log(JSON.stringify({
    event: 'test.worker_finished',
    task_id: taskId,
    pid: process.pid,
    status: task.status,
    outcome,
}));

if (outcome === 'processed' && task.status !== TaskStatusEnum.COMPLETED) {
    process.exitCode = 1;
}

