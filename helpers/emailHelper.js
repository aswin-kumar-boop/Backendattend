const {OAuth2Client} = require('google-auth-library'); // Updated import
const nodemailer = require('nodemailer');

// Environment variables
const emailUser = process.env.EMAIL_USER;
const emailClientId = process.env.EMAIL_CLIENT_ID;
const emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
const emailRefreshToken = process.env.EMAIL_REFRESH_TOKEN;
const emailService = process.env.EMAIL_SERVICE;

async function createTransporter() {
  const oauth2Client = new OAuth2Client( // Use OAuth2Client directly
    emailClientId,
    emailClientSecret,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: emailRefreshToken,
  });

  const accessToken = await new Promise((resolve, reject) => {
    oauth2Client.getAccessToken((err, token) => {
      if (err) {
        reject('Failed to create access token :(');
      } else {
        resolve(token);
      }
    });
  });

  const transporter = nodemailer.createTransport({
    service: emailService,
    auth: {
      type: 'OAuth2',
      user: emailUser,
      accessToken: accessToken.token, // Assuming accessToken is an object with a token property
      clientId: emailClientId,
      clientSecret: emailClientSecret,
      refreshToken: emailRefreshToken,
    },
  });

  return transporter;
}

// Function to send email
async function sendEmail(email, subject, text) {
  const transporter = await createTransporter();
  const mailOptions = {
    from: emailUser,
    to: email,
    subject: subject,
    text: text,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

module.exports = { sendEmail };
