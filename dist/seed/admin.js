"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_dns_1 = __importDefault(require("node:dns"));
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Override DNS to use Google + Cloudflare — fixes querySrv ECONNREFUSED on
// mobile hotspots and networks with restrictive carrier DNS servers
node_dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
const User_1 = __importDefault(require("../models/User"));
const seedAdmin = async () => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }
    try {
        await mongoose_1.default.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        const existingAdmin = await User_1.default.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log(`ℹ️  Admin already exists: ${existingAdmin.email}`);
            await mongoose_1.default.disconnect();
            process.exit(0);
        }
        const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
        const admin = await User_1.default.create({
            name: 'Administrator',
            email: 'admin@soapshop.com',
            password: hashedPassword,
            role: 'admin',
            isActive: true,
        });
        console.log('🎉 Admin user created successfully!');
        console.log(`   Name  : ${admin.name}`);
        console.log(`   Email : ${admin.email}`);
        console.log(`   Role  : ${admin.role}`);
        console.log('   Password: admin123  (change this after first login!)');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Seeding failed:', error.message);
        await mongoose_1.default.disconnect();
    }
};
seedAdmin();
