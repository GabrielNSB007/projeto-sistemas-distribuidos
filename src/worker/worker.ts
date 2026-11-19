import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import convertTxtToPdf from "../converters/txtToPdf.js";

import queue from "../broker/queue.js";
import {
  TASK_QUEUE,
  RESULT_QUEUE,
} from "../broker/config.js";

import type { Task } from "../tasks/task.model.js";
import { FileFormatEnum } from "../shared/enums/fileFormatEnum.js";
import { TaskStatusEnum } from "../shared/enums/taskStatusEnum.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const CONVERTIDOS_DIR = path.resolve(process.cwd(), "convertidos");

type ConverterFn = (input: Buffer, outputPath: string) => Promise<void>;

const CONVERTERS: Partial<Record<string, ConverterFn>> = {
  [`${FileFormatEnum.TXT}:${FileFormatEnum.PDF}`]: convertTxtToPdf
}

function getConverter(task: Task): ConverterFn {
  const key = `${task.formato_origem}:${task.formato_destino}`;
  const converter = CONVERTERS[key];

  if (!converter) {
    throw new Error(
      `Conversão não suportada: ${task.formato_origem} para ${task.formato_destino}`
    );
  }

  return converter;
}

async function processTask(task: Task): Promise<void> {
  console.log(`[Worker ${process.pid}] Iniciando tarefa: ${task.task_id} (${task.nome_arquivo})`);

  task.status = TaskStatusEnum.PROCESSING;
  task.timestamps = {
    criado_em: task.timestamps?.criado_em ?? new Date().toISOString(),
    iniciado_em: new Date().toISOString(),
    finalizado_em: null,
  }

  await queue.publish(RESULT_QUEUE, task);

  const sourceExt = task.formato_origem.toLowerCase();
  const targetExt = task.formato_destino.toLowerCase();

  const inputPath = path.join(
    UPLOAD_DIR,
    `${task.task_id}.${sourceExt}`
  );

  const outputFileName = `${task.task_id}.${targetExt}`

  const outputFullPath = path.join(
    CONVERTIDOS_DIR,
    outputFileName
  );

  try {
    const converter = getConverter(task);
    const file = await readFile(inputPath);


    await mkdir(CONVERTIDOS_DIR, {
      recursive: true,
    });

    await converter(file, outputFullPath);

    task.status = TaskStatusEnum.COMPLETED;
    task.caminho_resultado = path.join("convertidos", outputFileName);

    console.log(`[Worker ${process.pid}] Tarefa ${task.task_id} concluída!`);
  } catch (error) {
    task.status = TaskStatusEnum.FAILED;
    task.caminho_resultado = null;

    console.error(
      `[Worker ${process.pid}] Erro ao processar tarefa ${task.task_id}:`,
      error
    );
  } finally {
    task.timestamps.finalizado_em = new Date().toISOString();
  }

  await queue.publish(RESULT_QUEUE, task);
}

async function startWorker(): Promise<void> {
  console.log(`[Worker ${process.pid}] Iniciando worker...`);

  await queue.consume(TASK_QUEUE, processTask);

  console.log(`[Worker ${process.pid}] Aguardando tarefas em ${TASK_QUEUE}`);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`\n[Worker ${process.pid}] Sinal ${signal} recebido. Encerrando...`);
    if (typeof queue.close === "function") {
      await queue.close();
    }
    process.exit(0);
  });
}

startWorker().catch((error) => {
  console.error(`[Worker ${process.pid}] Erro ao iniciar worker:`, error);
  process.exit(1);
});
