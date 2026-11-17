
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import convertTxtToPdf from "../converters/txtToPdf.js";

import queue from "../broker/queue.js";
import {
  TASK_QUEUE,
  RESULT_QUEUE,
} from "../broker/config.js";

import type { Task } from "../tasks/task.model.js";
import { TaskStatusEnum } from "../shared/enums/taskStatusEnum.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const CONVERTIDOS_DIR = path.resolve(process.cwd(), "convertidos");

async function processTask(task: Task): Promise<void> {
  console.log(`Iniciando tarefa: ${task.task_id}`);

  task.status = TaskStatusEnum.PROCESSING;
  task.timestamps.iniciado_em = new Date().toISOString();

  const inputPath = path.join(
    UPLOAD_DIR,
    `${task.task_id}.txt`
  );

  const outputPath = path.join(
    CONVERTIDOS_DIR,
    `${task.task_id}.pdf`
  );

  try {
    const file = await readFile(inputPath);

    await mkdir(CONVERTIDOS_DIR, {
      recursive: true,
    });

    await convertTxtToPdf(file, outputPath);

    task.status = TaskStatusEnum.COMPLETED;
    task.caminho_resultado = outputPath;

    console.log(`Tarefa ${task.task_id} concluída!`);
  } catch (error) {
    task.status = TaskStatusEnum.FAILED;
    task.caminho_resultado = null;

    console.error(
      `Erro ao processar tarefa ${task.task_id}:`,
      error
    );
  } finally {
    task.timestamps.finalizado_em = new Date().toISOString();
  }

  await queue.publish(RESULT_QUEUE, task);
}

async function startWorker(): Promise<void> {
  console.log("Iniciando worker...");

  await queue.consume(TASK_QUEUE, processTask);

  console.log(`Worker aguardando tarefas em ${TASK_QUEUE}`);
}

startWorker().catch((error) => {
  console.error("Erro ao iniciar worker:", error);
  process.exit(1);
});
