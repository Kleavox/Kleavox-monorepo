//lib/mail.ts

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true", 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInviteEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const confirmLink = `${baseUrl}/verify?token=${token}`;

  await transporter.sendMail({
    from: `"DeauVault Admin" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Invitation to DeauVault",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5;">Welcome to DeauVault</h2>
        <p>You have been invited to join DeauVault Secure Storage.</p>
        <p>Please click the button below to activate your account:</p>
        <a href="${confirmLink}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Accept Invitation</a>
        <p style="color: #666; font-size: 12px;">This link is valid for 24 hours.</p>
      </div>
    `,
  });
}

export async function sendCredentialsEmail(email: string, password: string) {
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  await transporter.sendMail({
    from: `"DeauVault Admin" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your DeauVault Credentials",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #10b981;">Account Activated</h2>
        <p>Your account has been successfully created.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 1.1em;">${password}</code></p>
        </div>
        <p>You can now login at: <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="color: #ef4444; font-size: 12px;"><strong>Important:</strong> Please change your password if possible or keep this email safe.</p>
      </div>
    `,
  });
}
