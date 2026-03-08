//lib/mail.ts

import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  }
});

function getEmailTemplate(title: string, bodyContent: string, isDanger = false) {
  const accentColor = isDanger ? "#dc2626" : "#4f46e5";
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e4e4e7; }
        
        .header { background-color: ${accentColor}; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        
        .content { padding: 32px 24px; color: #1f2937; line-height: 1.6; font-size: 16px; }
        .footer { background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        
        .btn { 
            display: inline-block; 
            background-color: ${accentColor}; 
            color: #ffffff !important; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin-top: 24px; 
        }
        
        .otp-box { 
            background-color: #f3f4f6; 
            border: 1px dashed ${accentColor}; 
            color: ${accentColor}; 
            font-size: 28px; 
            font-weight: 700; 
            text-align: center; 
            padding: 16px; 
            margin: 24px 0; 
            letter-spacing: 4px; 
            border-radius: 6px; 
            font-family: monospace;
        }
        
        .text-muted { color: #6b7280; font-size: 14px; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DeauBit Admin</h1>
        </div>
        <div class="content">
          <h2 style="margin-top: 0; color: ${accentColor}; font-size: 18px;">${title}</h2>
          ${bodyContent}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} DeauBit. System Notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendVerificationEmail(email: string, otp: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error("SMTP Credentials missing");
  const htmlContent = `
    <p>Hello,</p>
    <p>Please verify your email address to complete your registration.</p>
    <div class="otp-box">${otp}</div>
    <p class="text-muted">This code expires in 15 minutes.</p>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Verify your email - DeauBit`,
    html: getEmailTemplate("Registration Verification", htmlContent),
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "localhost:3000";
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "http";
  const resetLink = `${protocol}://${appHost}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const htmlContent = `
    <p>We received a request to reset your password.</p>
    <p>Click the button below to proceed:</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="btn">Reset Password</a>
    </div>
    <p class="text-muted">Or copy this link: <br><a href="${resetLink}" style="color:#4f46e5;font-size:12px;">${resetLink}</a></p>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Reset Password - DeauBit",
    html: getEmailTemplate("Password Reset", htmlContent),
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "localhost:3000";
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "http";
  const loginLink = `${protocol}://${appHost}/login`;
  const htmlContent = `
    <p>Welcome, <strong>${name}</strong>!</p>
    <p>Your account is now active. You can start shortening links immediately.</p>
    <div style="text-align: center;">
      <a href="${loginLink}" class="btn">Go to Dashboard</a>
    </div>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Welcome to DeauBit! 🚀",
    html: getEmailTemplate("Account Verified", htmlContent),
  });
}

export async function sendAccountDeletedEmail(email: string, name: string) {
  const htmlContent = `
    <p>Hi ${name},</p>
    <p>Your account and data have been permanently deleted as requested.</p>
    <p>We're sorry to see you go.</p>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Account Deleted",
    html: getEmailTemplate("Goodbye", htmlContent),
  });
}


export async function sendAdminVerificationEmail(email: string, otp: string) {
  const htmlContent = `
    <p><strong>Admin Setup Verification</strong></p>
    <p>You are initializing the Administrator account for DeauBit.</p>
    <p>Please use the code below to complete the setup:</p>
    <div class="otp-box">${otp}</div>
    <p class="text-muted">Do not share this code.</p>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Admin Verification Code: ${otp}`,
    html: getEmailTemplate("Confirm Admin Setup", htmlContent, true), 
  });
}

export async function sendAdminWelcomeEmail(email: string, name: string) {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "localhost:3000";
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "http";
  const loginLink = `${protocol}://${appHost}/login`;
  
  const htmlContent = `
    <p><strong>System Ready</strong></p>
    <p>Hello <strong>${name}</strong>, Administrator access has been granted.</p>
    <p>You now have full control over the DeauBit system.</p>
    <div style="text-align: center;">
      <a href="${loginLink}" class="btn">Open Admin Console</a>
    </div>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Admin Access Granted",
    html: getEmailTemplate("Setup Complete", htmlContent),
  });
}

export async function sendAdminDeletionCodeEmail(email: string, otp: string) {
  const htmlContent = `
    <p><strong>Reset Confirmation</strong></p>
    <p>A request to <strong>reset the entire database</strong> has been received.</p>
    <p>If you proceed, all users and links will be deleted. Use the code below to confirm:</p>
    <div class="otp-box" style="color: #dc2626; border-color: #dc2626;">${otp}</div>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Reset Confirmation Code: ${otp}`,
    html: getEmailTemplate("Critical Action", htmlContent, true),
  });
}

export async function sendAdminGoodbyeEmail(email: string, name: string) {
  const htmlContent = `
    <p><strong>System Reset Complete</strong></p>
    <p>Administrator ${name},</p>
    <p>The system database has been cleared. The application is now ready for a fresh setup.</p>
  `;
  return await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "System Reset Successful",
    html: getEmailTemplate("Reset Complete", htmlContent, true),
  });
}

export async function sendAbuseReportEmail(data: { linkUrl: string; reason: string; details: string; reporter: string; adminEmail?: string; }) {
  const targetEmail = data.adminEmail || process.env.SMTP_USER;
  let slug = "";
  try { const urlParts = new URL(data.linkUrl); slug = urlParts.pathname.replace(/^\//, ""); } catch {}
  
  const deleteToken = jwt.sign({ slug, action: 'delete_abuse' }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "localhost:3000";
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "http";
  const deleteLink = `${protocol}://${appHost}/admin/delete?slug=${slug}&token=${deleteToken}`;
  
  const subject = `Link Review Request: /${slug || 'Unknown'}`; 
  
  const htmlContent = `
    <p><strong>User Report</strong></p>
    <p>A link has been flagged for review.</p>
    <div style="background:#f9fafb; border:1px solid #e5e7eb; padding:15px; margin:20px 0; border-radius:6px; color:#374151;">
       <p style="margin:5px 0"><strong>URL:</strong> <span style="background:#eee; padding:2px 6px; border-radius:4px; font-family:monospace;">${escapeHtml(data.linkUrl)}</span></p>
       <p style="margin:5px 0"><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>
       <p style="margin:5px 0"><strong>Details:</strong> ${escapeHtml(data.details || "-")}</p>
    </div>
    <div style="text-align: center; margin-top: 24px;">
        <a href="${deleteLink}" class="btn" style="background-color: #dc2626 !important;">Review & Delete</a>
    </div>
  `;
  return await transporter.sendMail({ 
      from: process.env.SMTP_FROM, 
      to: targetEmail, 
      subject: subject, 
      html: getEmailTemplate("Report Received", htmlContent), 
  });
}
