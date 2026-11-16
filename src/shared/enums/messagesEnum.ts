import { UPLOAD_LIMITS } from '../constants/app.constants.js';

export enum MessagesEnum {
    FILE_REQUIRED = 'Envie um arquivo TXT no campo arquivo.',
    INVALID_SOURCE_FORMAT = 'Somente arquivos .txt são aceitos.',
    INVALID_TARGET_FORMAT = 'O campo formato_destino deve ser pdf.',
    INVALID_TEXT_FILE = 'O arquivo deve conter texto UTF-8 e não pode estar vazio.',
    INVALID_UPLOAD = 'Upload inválido. Envie um arquivo no campo arquivo e o campo formato_destino.',
    TASK_CREATION_FAILED = 'Não foi possível criar a tarefa.',
}

export const FILE_TOO_LARGE_MESSAGE = `O tamanho máximo do arquivo é ${UPLOAD_LIMITS.MAX_FILE_SIZE_MIB} MiB.`;
