const axios = require('axios');

const sendEmail = async (options) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || 'Priyanshu Gupta - NITJ Hostel Management';

  if (!apiKey) {
    throw new Error('Brevo API key not configured. Please add BREVO_API_KEY to environment variables.');
  }

  if (!fromEmail) {
    throw new Error('Brevo from email not configured. Please add BREVO_FROM_EMAIL to environment variables.');
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: fromEmail,
          name: fromName
        },
        to: [{ email: options.email }],
        subject: options.subject,
        htmlContent: options.html
      },
      {
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('Brevo email sent successfully:', response.data?.messageId || 'accepted');
    return response.data;
  } catch (error) {
    const details = error.response?.data;
    console.error('Brevo email sending error:', details || error.message);
    throw new Error(details?.message || details?.code || error.message || 'Failed to send email');
  }
};

module.exports = sendEmail;
