const express = require('express');
const router = express.Router();

const webhooksRouter = require('./webhooks');
const proxyRouter = require('./proxy');

router.use('/webhooks', webhooksRouter);
router.use('/api/proxy', proxyRouter);

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
