"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_dns_1 = __importDefault(require("node:dns"));
const db_1 = __importDefault(require("./config/db"));
const products_1 = __importDefault(require("./routes/products"));
const auth_1 = __importDefault(require("./routes/auth"));
const sales_1 = __importDefault(require("./routes/sales"));
// Set public DNS servers before any network calls to bypass local SRV resolution issues
node_dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
// Connect to Database
(0, db_1.default)();
const app = (0, express_1.default)();
// Global Middlewares
const corsOptions = {
    origin: '*', // Allow all origins — restrict to your frontend domain in production if needed
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions)); // Handle preflight OPTIONS requests for all routes
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/products', products_1.default);
app.use('/api/sales', sales_1.default);
// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Nimako POS API (TypeScript) is running.',
        timestamp: new Date().toISOString(),
    });
});
// 404 Route Not Found Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found.`,
    });
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'File is too large. Maximum allowed size is 5MB.',
        });
    }
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error.',
    });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Nimako POS Server (TS) is running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Base URL: http://localhost:${PORT}/api/products`);
});
