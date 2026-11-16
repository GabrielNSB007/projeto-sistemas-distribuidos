export const SERVER_PORT = 3000;
export const SERVER_HOST = '0.0.0.0';
export const UPLOADS_DIRECTORY = 'uploads';

const MAX_FILE_SIZE_MIB = 10;

export const UPLOAD_LIMITS = {
    MAX_FILE_SIZE_MIB,
    MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_MIB * 1024 * 1024,
    MAX_FILES: 1,
    MAX_FIELDS: 1,
    MAX_FIELD_SIZE_BYTES: 100,
    MAX_PARTS: 2,
} as const;

export const UPLOAD_FIELDS = {
    FILE: 'arquivo',
    TARGET_FORMAT: 'formato_destino',
} as const;
