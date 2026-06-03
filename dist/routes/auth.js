"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/auth/login  → public
router.post('/login', authController_1.login);
// GET  /api/auth/me     → protected (valid JWT required)
router.get('/me', auth_1.protect, authController_1.getMe);
exports.default = router;
