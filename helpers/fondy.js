const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

function generateSignature(data, secretKey) {
  const sortedKeys = Object.keys(data).sort();
  const signatureString = sortedKeys.map(key => data[key]).join('|');
  return crypto
    .createHash('sha1')
    .update(secretKey + '|' + signatureString)
    .digest('hex');
}

/**
 * Creates a Fondy payment link
 * @param {Object} options
 * @param {number} options.amount - Amount in major currency units
 * @param {string} options.currency - Currency code (e.g. UAH)
 * @param {string} options.orderId - Unique order ID
 * @param {string} options.orderDesc - Order description
 * @param {string} [options.responseUrl] - URL for Fondy to redirect after payment
 * @returns {Promise<string>} Payment URL
 */
async function createPaymentLink({ amount, currency, orderId, orderDesc, responseUrl }) {
  const merchantId = process.env.FONDY_MERCHANT_ID;
  const secretKey = process.env.FONDY_SECRET_KEY;
  if (!merchantId || !secretKey) {
    throw new Error('Fondy credentials are not configured');
  }

  const request = {
    order_id: orderId,
    order_desc: orderDesc,
    amount: amount * 100, // Fondy expects amount in minor units
    currency,
    merchant_id: merchantId,
  };
  if (responseUrl) request.response_url = responseUrl;

  request.signature = generateSignature(request, secretKey);

  try {
    const { data } = await axios.post('https://pay.fondy.eu/api/checkout/url/', { request });
    if (data.response && data.response.checkout_url) {
      return data.response.checkout_url;
    }
    logger.error('Fondy API response missing checkout_url', data);
    throw new Error('Fondy payment link error');
  } catch (err) {
    logger.error('Fondy payment request failed', err);
    throw err;
  }
}

module.exports = { createPaymentLink };
