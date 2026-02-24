require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', routes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Shopify Loyalty Points Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`\nWebhook endpoints:`);
  console.log(`  POST http://localhost:${PORT}/webhooks/orders/paid`);
  console.log(`  POST http://localhost:${PORT}/webhooks/orders/refunded`);
  console.log(`  POST http://localhost:${PORT}/webhooks/app/uninstalled`);
  console.log(`  POST http://localhost:${PORT}/webhooks/gdpr/customer_data_request`);
  console.log(`  POST http://localhost:${PORT}/webhooks/gdpr/customer_redact`);
  console.log(`  POST http://localhost:${PORT}/webhooks/gdpr/shop_redact`);
  console.log(`\nProxy endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/api/proxy/points`);
  console.log(`  POST http://localhost:${PORT}/api/proxy/redeem`);
  console.log(`  GET  http://localhost:${PORT}/api/proxy/referral`);
});

module.exports = app;
