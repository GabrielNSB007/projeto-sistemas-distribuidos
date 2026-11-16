import type { FileFormatEnum } from '../shared/enums/fileFormatEnum.js';
import type { TaskStatusEnum } from '../shared/enums/taskStatusEnum.js';

export type TaskStatus = TaskStatusEnum;

/** Datas em strings ISO 8601, para manter o mesmo formato nas mensagens JSON. */
export interface TaskTimestamps {
    criado_em: string;
    iniciado_em: string | null;
    finalizado_em: string | null;
}

/** Estado de uma tarefa de conversão TXT para PDF. */
export interface Task {
    task_id: string;
    nome_arquivo: string;
    formato_origem: FileFormatEnum.TXT;
    formato_destino: FileFormatEnum.PDF;
    status: TaskStatus;
    timestamps: TaskTimestamps;
    caminho_resultado: string | null;
}
