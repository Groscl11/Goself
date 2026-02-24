const crypto = require('crypto');

function verifyShopifyWebhook(secret) {
  return (req, res, next) => {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

    if (!hmacHeader) {
      console.error('Missing HMAC header');
      return res.status(401).json({ error: 'Unauthorized: Missing HMAC' });
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody, 'utf8')
      .digest('base64');

    if (hash !== hmacHeader) {
      console.error('HMAC verification failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid HMAC' });
    }

    console.log('HMAC verification successful');
    next();
  };
}

function verifyShopifyProxy(secret) {
  return (req, res, next) => {
    const { signature, ...queryParams } = req.query;

    if (!signature) {
      console.error('Missing proxy signature');
      return res.status(401).json({ error: 'Unauthorized: Missing signature' });
    }

    const sortedParams = Object.keys(queryParams)
      .sort()
      .map(key => `${key}=${queryParams[key]}`)
      .join('');

    const hash = crypto
      .createHmac('sha256', secret)
      .update(sortedParams, 'utf8')
      .digest('hex');

    if (hash !== signature) {
      console.error('Proxy signature verification failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
    }

    console.log('Proxy signature verification successful');
    next();
  };
}

function rawBodyParser(req, res, next) {
  let data = '';

  req.setEncoding('utf8');
  req.on('data', chunk => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (e) {
      req.body = {};
    }
    next();
  });
}

module.exports = {
  verifyShopifyWebhook,
  verifyShopifyProxy,
  rawBodyParser
};
