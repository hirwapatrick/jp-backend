import nodemailer from "nodemailer";
import dns from "dns";

// Force IPv4 first (helps on Render)
dns.setDefaultResultOrder("ipv4first");

const createTransporter = async () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn(
      "⚠️ SMTP credentials missing. Emails will be logged to console."
    );
    return null;
  }

  const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user,
    pass,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

  try {
    await transporter.verify();
    console.log("✅ SMTP Server Ready");
  } catch (err) {
    console.error("❌ SMTP Verify Failed:");
    console.error(err);
    return null;
  }

  return transporter;
};

export const sendReplyEmail = async ({
  toEmail,
  toName,
  replyMessage,
  originalMessage,
}) => {
  const transporter = await createTransporter();

  if (!transporter) {
    console.log(`
====================================================
EMAIL SIMULATION
To: ${toName} <${toEmail}>
Message:
${replyMessage}
====================================================
`);
    return {
      success: false,
      simulated: true,
      error: "SMTP unavailable",
    };
  }

  const fromName =
    process.env.SMTP_FROM_NAME || "Jacques Photography";

  const fromEmail =
    process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

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

          <blockquote
            style="
              margin:0;
              padding:10px 15px;
              border-left:4px solid #ddd;
              color:#666;
              background:#fff;
            "
          >
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
      to: `"${toName}" <${toEmail}>`,
      subject: `Re: Your inquiry - ${fromName}`,
      html,
    });

    console.log("✅ Email sent successfully");
    console.log("Message ID:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ Email send failed");
    console.error("Code:", error.code);
    console.error("Response:", error.response);
    console.error("Message:", error.message);

    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};