import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Override DNS to use Google + Cloudflare — fixes querySrv ECONNREFUSED on
// mobile hotspots and networks with restrictive carrier DNS servers
dns.setServers(['8.8.8.8', '1.1.1.1']);
import User from '../models/User';

const seedAdmin = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log(`ℹ️  Admin already exists: ${existingAdmin.email}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await User.create({
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

    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    await mongoose.disconnect();

  }
};

seedAdmin();
