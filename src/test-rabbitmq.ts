import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { TASK_QUEUE } from './broker/config.js';
import { UPLOADS_DIRECTORY } from './shared/constants/app.constants.js';
import queue from "./broker/queue.js";
import {FileFormatEnum} from "./shared/enums/fileFormatEnum.js";
import {TaskStatusEnum} from "./shared/enums/taskStatusEnum.js";

async function main() {
    const taskId = randomUUID();
    const fileName = 'teste.txt';
    await mkdir(UPLOADS_DIRECTORY, { recursive: true });
    await copyFile(fileName, path.join(UPLOADS_DIRECTORY, `${taskId}.txt`), constants.COPYFILE_EXCL);

    await queue.publish(TASK_QUEUE, {
        task_id: taskId,
        nome_arquivo: fileName,
        formato_origem: FileFormatEnum.TXT,
        formato_destino: FileFormatEnum.PDF,
        status: TaskStatusEnum.PENDING,
        timestamps: {
            criado_em: new Date().toISOString(),
            iniciado_em: null,
            finalizado_em: null
        },
        caminho_resultado: null
    });

    console.log(`Tarefa publicada: ${taskId}`);
}

main()
    .finally(() => queue.close())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });