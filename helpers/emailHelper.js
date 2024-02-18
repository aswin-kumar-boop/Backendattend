const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");

// Environment variables

const jwtSecret = process.env.JWT_SECRET;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailClientId = process.env.EMAIL_CLIENT_ID;
const emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
const emailRefreshToken = process.env.EMAIL_REFRESH_TOKEN;
const emailService = process.env.EMAIL_SERVICE; // For example, 'Gmail'
const clientURL = process.env.CLIENT_URL; // Ensure this is HTTPS in production
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Email transport configuration using OAuth2 for Gmail
const transporter = nodemailer.createTransport({
  service: emailService,
  auth: {
    type: "OAuth2",
    user: emailUser,
    clientId: emailClientId,
    clientSecret: emailClientSecret,
    refreshToken: emailRefreshToken,
  },
});

// Function to send OTP email
const sendEmail = (email, subject, text) => {
  const mailOptions = {
    from: emailUser,
    to: email,
    subject: subject,
    text: text,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
};

module.exports = { sendEmail };


