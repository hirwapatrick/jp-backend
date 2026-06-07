import emailjs from "@emailjs/nodejs";
import dotenv from "dotenv";

dotenv.config();

export const sendReplyEmail = async ({
  toEmail,
  toName,
  replyMessage,
  originalMessage,
}) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.log(`
====================================================
EMAIL SIMULATION
Reason: EmailJS credentials missing
To: ${toName} <${toEmail}>
Message:
${replyMessage}
====================================================
`);
    return {
      success: false,
      simulated: true,
      error: "EmailJS credentials missing",
    };
  }

  const templateParams = {
    to_email: toEmail,
    to_name: toName,
    reply_message: replyMessage,
    original_message: originalMessage || "No original message",
    from_name: process.env.FROM_NAME || "Jacques Photography",
  };

  try {
    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      {
        publicKey,
        privateKey,
      },
    );

    console.log("✅ Email sent successfully via EmailJS:", response.status);
    return { success: true, messageId: response.text };
  } catch (error) {
    console.error("❌ EmailJS send failed:", error.message || error);
    return { success: false, error: error.message || "EmailJS error" };
  }
};
