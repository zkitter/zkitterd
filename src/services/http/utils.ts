import multer from 'multer';

export const upload = multer({
  dest: './uploaded_files',
});

export function makeResponse(payload: any, error?: boolean) {
  return {
    error,
    payload,
  };
}
