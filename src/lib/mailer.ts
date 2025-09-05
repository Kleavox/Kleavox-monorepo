import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ADMIN_EMAIL } = process.env;

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: (Number(SMTP_PORT || 587) === 465),
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

type MailOptions = Parameters<typeof transport.sendMail>[0];
type Attachment = NonNullable<MailOptions['attachments']>[number];

export async function sendRecapEmail(subject: string, htmlBody: string, attachments: Attachment[] = []) {
  if (!SMTP_HOST || !ADMIN_EMAIL) {
    console.warn("SMTP or ADMIN_EMAIL is not configured. Skipping email.");
    return;
  }

  await transport.sendMail({
    from: SMTP_FROM,
    to: ADMIN_EMAIL,
    subject: subject,
    html: htmlBody,
    attachments: attachments,
  });
}