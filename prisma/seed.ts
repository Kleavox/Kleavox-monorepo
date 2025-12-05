// prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "example@gmail.com";
  
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" }
  });

  if (existingAdmin) {
    console.log("✅ Admin account already exists.");
    return;
  }

  const rawPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: "Super Admin",
      role: "ADMIN"
    }
  });

  console.log("🎉 Admin account created successfully!");
  console.log("------------------------------------------------");
  console.log(`📧 Email:    ${adminEmail}`);
  console.log(`🔑 Password: ${rawPassword}`);
  console.log("------------------------------------------------");
  console.log("⚠️  SAVE THIS PASSWORD! It will not be shown again.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
