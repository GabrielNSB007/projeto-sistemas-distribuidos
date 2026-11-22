import path from "node:path";
import convertTxtToPdf from "../converters/txtToPdf.js";

import queue from "../broker/queue.js";
import {
  TASK_QUEUE,
  RESULT_QUEUE,
} from "../broker/config.js";

import type { Task } from "../tasks/task.model.js";
import { FileFormatEnum } from "../shared/enums/fileFormatEnum.js";
import { logTaskLifecycle } from "../shared/logging/task-lifecycle.js";
import { processTask, type ConverterFn } from "./task-processor.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const CONVERTIDOS_DIR = path.resolve(process.cwd(), "convertidos");
const CLAIMS_DIR = path.resolve(UPLOAD_DIR, ".task-claims");

const CONVERTERS: Partial<Record<string, ConverterFn>> = {
  [`${FileFormatEnum.TXT}:${FileFormatEnum.PDF}`]: convertTxtToPdf
};

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

async function handleTask(task: Task): Promise<void> {
  await processTask(task, {
    uploadsDirectory: UPLOAD_DIR,
    resultsDirectory: CONVERTIDOS_DIR,
    claimsDirectory: CLAIMS_DIR,
    converterFor: getConverter,
    publishResult: (result) => queue.publish(RESULT_QUEUE, result),
  });
}

async function startWorker(): Promise<void> {
  logTaskLifecycle('worker.started', null, { worker_pid: process.pid });

  await queue.consume(TASK_QUEUE, handleTask);

  logTaskLifecycle('worker.waiting_for_tasks', null, {
    worker_pid: process.pid,
    queue: TASK_QUEUE,
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logTaskLifecycle('worker.stopping', null, {
      worker_pid: process.pid,
      signal,
    });
    if (typeof queue.close === "function") {
      await queue.close();
    }
    process.exit(0);
  });
}

startWorker().catch((error) => {
  logTaskLifecycle('worker.start_failed', null, {
    worker_pid: process.pid,
    error: error instanceof Error ? error.message : String(error),
  }, 'error');
  process.exit(1);
});
