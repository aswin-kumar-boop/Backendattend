const {OAuth2Client} = require('google-auth-library');
const nodemailer = require('nodemailer');

// Assuming these environment variables are set
const emailUser = process.env.EMAIL_USER;
const emailClientId = process.env.EMAIL_CLIENT_ID;
const emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
const emailRefreshToken = process.env.EMAIL_REFRESH_TOKEN;
const emailService = process.env.EMAIL_SERVICE;

async function createTransporter() {
  const oauth2Client = new OAuth2Client(
    emailClientId,
    emailClientSecret,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: emailRefreshToken,
  });

  try {
    const accessToken = await new Promise((resolve, reject) => {
      oauth2Client.getAccessToken((err, token) => {
        if (err) {
          reject(new Error('Failed to create access token'));
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
        accessToken: accessToken.token, // Adjust based on the actual structure of accessToken
        clientId: emailClientId,
        clientSecret: emailClientSecret,
        refreshToken: emailRefreshToken,
      },
    });

    return transporter;
  } catch (error) {
    console.error('Error creating transporter:', error);
    throw error; // Rethrow the error after logging it
  }
}

// Updated sendEmail function with error handling
async function sendEmail(email, subject, text) {
  try {
    const transporter = await createTransporter();
    const mailOptions = {
      from: emailUser,
      to: email,
      subject: subject,
      text: text,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { sendEmail };
