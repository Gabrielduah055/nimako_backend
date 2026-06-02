import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

// Store uploaded files in memory
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  const allowedExtensions = /\.(xlsx|xls)$/i;

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.test(file.originalname)
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .xlsx and .xls files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

export default upload;
