import nodemailer from 'nodemailer';

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const fromName = process.env.SMTP_FROM_NAME || 'Jacques Photography';
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!user || !pass) {
    console.warn('⚠️ SMTP not configured. Emails will be logged to console only.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export const sendReplyEmail = async ({ toEmail, toName, replyMessage, originalMessage }) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`Reply to ${toName} <${toEmail}>: ${replyMessage}`);
    return { success: true, simulated: true };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'Jacques Photography';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `
    <div style="font-family: 'Helvetica', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 30px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-weight: 300;">${fromName}</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="color: #333; font-size: 16px;">Hi <strong>${toName}</strong>,</p>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">${replyMessage}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          This is a reply to your inquiry about photography services.
        </p>
      </div>
      <div style="background: #000; padding: 15px; text-align: center;">
        <p style="color: #666; font-size: 11px; margin: 0;">
          &copy; ${new Date().getFullYear()} ${fromName}
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: `Re: Your inquiry - ${fromName}`,
      html,
    });
    console.log(`Email sent to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Email send failed:', error.message);
    return { success: false, error: error.message };
  }
};
