require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const app = express();

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 3,
  message: { success: false, message: 'Too many OTP requests. Wait 1 minute.' },
});

app.use('/api/', apiLimiter);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', app: 'WedQuick API', version: '1.0.0' }));

// ── Routes ────────────────────────────────────────────────────
const prefix = '/api/v1';
app.use(`${prefix}/auth`,         otpLimiter,                 require('./routes/auth'));
app.use(`${prefix}/products`,                                  require('./routes/products'));
app.use(`${prefix}/categories`,                                require('./routes/categories'));
app.use(`${prefix}/orders`,                                    require('./routes/orders'));
app.use(`${prefix}/rentals`,                                   require('./routes/rentals'));
app.use(`${prefix}/cart`,                                      require('./routes/cart'));
app.use(`${prefix}/wishlist`,                                  require('./routes/wishlist'));
app.use(`${prefix}/requirements`,                              require('./routes/requirements'));
app.use(`${prefix}/quotations`,                                require('./routes/quotations'));
app.use(`${prefix}/banners`,                                   require('./routes/banners'));
app.use(`${prefix}/reviews`,                                   require('./routes/reviews'));
app.use(`${prefix}/notifications`,                             require('./routes/notifications'));
app.use(`${prefix}/profile`,                                   require('./routes/profile'));
app.use(`${prefix}/vendor`,                                    require('./routes/vendor'));
app.use(`${prefix}/admin`,                                     require('./routes/admin'));
app.use(`${prefix}/payments`,                                  require('./routes/payments'));
app.use(`${prefix}/tracking`,                                  require('./routes/tracking'));

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` }));

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥  Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀  WedQuick API running on port ${PORT}`));
