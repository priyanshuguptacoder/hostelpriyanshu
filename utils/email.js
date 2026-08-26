const axios = require('axios');

const sendEmail = async (options = {}) => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim();
  const fromName = process.env.BREVO_FROM_NAME?.trim() || 'Hostel Management System';

  if (!apiKey) {
    throw new Error('Email service is not configured: BREVO_API_KEY is missing.');
  }

  if (!fromEmail) {
    throw new Error('Email service is not configured: BREVO_FROM_EMAIL is missing.');
  }

  if (!options.email || !options.subject || !options.html) {
    throw new Error('Email service received an incomplete message.');
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: fromEmail,
          name: fromName
        },
        to: [{ email: String(options.email).trim().toLowerCase() }],
        subject: String(options.subject).trim(),
        htmlContent: String(options.html),
        ...(options.text ? { textContent: String(options.text) } : {}),
        ...(process.env.BREVO_REPLY_TO_EMAIL ? {
          replyTo: {
            email: process.env.BREVO_REPLY_TO_EMAIL.trim(),
            name: fromName
          }
        } : {})
      },
      {
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        timeout: 20000,
        validateStatus: status => status >= 200 && status < 300
      }
    );

    console.log('[email] Brevo accepted message:', response.data?.messageId || 'accepted');
    return response.data;
  } catch (error) {
    const details = error.response?.data;
    const providerMessage = details?.message || details?.code;
    console.error('[email] Brevo delivery failed:', {
      status: error.response?.status,
      code: providerMessage,
      message: error.message
    });

    if (error.code === 'ECONNABORTED') {
      throw new Error('Email provider timed out. Please try again in a moment.');
    }

    throw new Error(providerMessage || error.message || 'Failed to send email.');
  }
};

module.exports = sendEmail;
