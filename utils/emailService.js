import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const sendReplyEmail = async ({
  toEmail,
  toName,
  replyMessage,
  originalMessage,
}) => {
  if (!resend) {
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
      error: "Resend API key missing",
    };
  }

  const fromName =
    process.env.RESEND_FROM_NAME || "Jacques Photography";

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

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
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: `Re: Your inquiry - ${fromName}`,
      html,
    });

    if (error) {
      console.error("Email send failed");
      console.error(error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log("Email sent successfully");
    console.log("Email ID:", data.id);

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error("Email send failed");
    console.error("Message:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};
