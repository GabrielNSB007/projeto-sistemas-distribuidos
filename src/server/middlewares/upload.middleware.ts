import { UPLOAD_LIMITS } from '../../shared/constants/app.constants.js';
import multer from 'multer';

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES,
        files: UPLOAD_LIMITS.MAX_FILES,
        fields: UPLOAD_LIMITS.MAX_FIELDS,
        fieldSize: UPLOAD_LIMITS.MAX_FIELD_SIZE_BYTES,
        parts: UPLOAD_LIMITS.MAX_PARTS,
    },
});
