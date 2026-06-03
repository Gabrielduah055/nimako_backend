"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_dns_1 = __importDefault(require("node:dns"));
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
// Fix DNS SRV resolution on restrictive networks (mobile hotspots, carrier DNS)
node_dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
const cashiers = [
    { name: 'Cashier John', email: 'john@soapshop.com', password: 'cashier123', role: 'cashier' },
    { name: 'Cashier Mary', email: 'mary@soapshop.com', password: 'cashier123', role: 'cashier' },
    { name: 'Cashier Peter', email: 'peter@soapshop.com', password: 'cashier123', role: 'cashier' },
];
const seedCashiers = async () => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }
    try {
        await mongoose_1.default.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        for (const cashier of cashiers) {
            const exists = await User_1.default.findOne({ email: cashier.email });
            if (exists) {
                console.log(`ℹ️  Skipped (already exists): ${cashier.email}`);
                continue;
            }
            const hashedPassword = await bcryptjs_1.default.hash(cashier.password, 10);
            await User_1.default.create({ ...cashier, password: hashedPassword });
            console.log(`🎉 Created cashier: ${cashier.name} (${cashier.email})`);
        }
        console.log('\n✅ Cashier seeding complete.');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Seeding failed:', error.message);
        await mongoose_1.default.disconnect();
        process.exit(1);
    }
};
seedCashiers();
