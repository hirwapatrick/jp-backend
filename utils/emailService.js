// Simple email service example (implement with your preferred email service)
export const sendContactConfirmation = async ({ name, email }) => {
  // Implement with nodemailer, SendGrid, etc.
  console.log(`Sending confirmation email to ${name} at ${email}`);
  // Your email sending logic here
};

export const sendNewContactNotification = async (contact) => {
  // Implement with nodemailer, SendGrid, etc.
  console.log(`New contact from ${contact.name} (${contact.email})`);
  // Your email sending logic here
};