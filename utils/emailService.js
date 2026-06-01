import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendReplyEmail = async ({
  toEmail,
  toName,
  replyMessage,
  originalMessage,
}) => {
  // Fallback simulation
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`
====================================================
EMAIL SIMULATION
Reason: SMTP credentials missing
To: ${toName} <${toEmail}>
Message:
${replyMessage}
====================================================
`);
    return {
      success: false,
      simulated: true,
      error: "SMTP credentials missing",
    };
  }

  const fromName = process.env.FROM_NAME || "Jacques Photography";
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      
      <div style="background:#000;padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-weight:300;">
          ${fromName}
        </h1>
      </div>

      <div style="padding:30px;background:#f9f9f9;">
        <p style="font-size:16px;color:#333;">
          Hi <strong>${toName}</strong>,
        </p>

        <p style="font-size:15px;line-height:1.7;color:#555;">
          ${replyMessage}
        </p>

        ${
          originalMessage
            ? `
          <hr style="margin:25px 0;border:none;border-top:1px solid #ddd;" />

          <p style="font-size:13px;color:#777;">
            <strong>Your original message:</strong>
          </p>

          <blockquote style="
            margin:0;
            padding:10px 15px;
            border-left:4px solid #ddd;
            color:#666;
            background:#fff;
          ">
            ${originalMessage}
          </blockquote>
        `
            : ""
        }

        <hr style="margin:25px 0;border:none;border-top:1px solid #ddd;" />

        <p style="font-size:12px;color:#999;">
          Thank you for contacting ${fromName}.
        </p>
      </div>

      <div style="background:#000;padding:15px;text-align:center;">
        <p style="font-size:11px;color:#888;margin:0;">
          © ${new Date().getFullYear()} ${fromName}
        </p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: `Re: Your inquiry - ${fromName}`,
      html,
    });

    console.log("Email sent successfully:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Email send failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};
