const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Send email
  const message = {
    from: `${process.env.FROM_NAME || 'Advocate Management System'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html
  };

  await transporter.sendMail(message);
};

module.exports = { sendEmail };
