import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

// Fix DNS SRV resolution on restrictive networks (mobile hotspots, carrier DNS)
dns.setServers(['8.8.8.8', '1.1.1.1']);

interface CashierSeed {
  name: string;
  email: string;
  password: string;
  role: 'cashier';
}

const cashiers: CashierSeed[] = [
  { name: 'Cashier John',  email: 'john@soapshop.com',  password: 'cashier123', role: 'cashier' },
  { name: 'Cashier Mary',  email: 'mary@soapshop.com',  password: 'cashier123', role: 'cashier' },
  { name: 'Cashier Peter', email: 'peter@soapshop.com', password: 'cashier123', role: 'cashier' },
];

const seedCashiers = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    for (const cashier of cashiers) {
      const exists = await User.findOne({ email: cashier.email });

      if (exists) {
        console.log(`ℹ️  Skipped (already exists): ${cashier.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(cashier.password, 10);
      await User.create({ ...cashier, password: hashedPassword });
      console.log(`🎉 Created cashier: ${cashier.name} (${cashier.email})`);
    }

    console.log('\n✅ Cashier seeding complete.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedCashiers();
