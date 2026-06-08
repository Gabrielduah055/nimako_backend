"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const syncController_1 = require("../controllers/syncController");
const router = (0, express_1.Router)();
router.post('/sync', auth_1.protect, syncController_1.syncTransaction);
exports.default = router;
