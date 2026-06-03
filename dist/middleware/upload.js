"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
// Store uploaded files in memory
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
    ];
    const allowedExtensions = /\.(xlsx|xls)$/i;
    if (allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.test(file.originalname)) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type. Only .xlsx and .xls files are allowed.'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
    },
});
exports.default = upload;
