import queue from "./broker/queue.js";
import {FileFormatEnum} from "./shared/enums/fileFormatEnum.js";
import {TaskStatusEnum} from "./shared/enums/taskStatusEnum.js";

async function main() {
    await queue.createQueue("task_queue");

    await queue.publish("task_queue", {
        task_id: "teste-001",
        nome_arquivo: "arquivo.txt",
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

    console.log("Teste finalizado!");
}

main().catch(console.error);