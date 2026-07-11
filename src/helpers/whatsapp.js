const axios = require('axios');

// ── Send WhatsApp message via WABA ────────────────────────────
async function sendWhatsApp(phone, templateName, components = []) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`💬  [DEV] WhatsApp to ${phone}: template=${templateName}`);
    return true;
  }
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WABA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: `91${phone}`,
        type: 'template',
        template: { name: templateName, language: { code: 'en_IN' }, components },
      },
      { headers: { Authorization: `Bearer ${process.env.WABA_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    return true;
  } catch (err) {
    console.error('WhatsApp error:', err.response?.data || err.message);
    return false;
  }
}

// ── Notify order placed ───────────────────────────────────────
async function notifyOrderPlaced(phone, orderNumber, amount) {
  return sendWhatsApp(phone, 'order_placed', [
    { type: 'body', parameters: [
      { type: 'text', text: orderNumber },
      { type: 'text', text: `₹${amount}` },
    ]},
  ]);
}

// ── Notify order out for delivery ────────────────────────────
async function notifyOutForDelivery(phone, orderNumber, riderName, riderPhone) {
  return sendWhatsApp(phone, 'order_out_for_delivery', [
    { type: 'body', parameters: [
      { type: 'text', text: orderNumber },
      { type: 'text', text: riderName },
      { type: 'text', text: riderPhone },
    ]},
  ]);
}

// ── Notify rental return reminder ────────────────────────────
async function notifyRentalReturn(phone, productName, returnDate) {
  return sendWhatsApp(phone, 'rental_return_reminder', [
    { type: 'body', parameters: [
      { type: 'text', text: productName },
      { type: 'text', text: returnDate },
    ]},
  ]);
}

module.exports = { sendWhatsApp, notifyOrderPlaced, notifyOutForDelivery, notifyRentalReturn };
