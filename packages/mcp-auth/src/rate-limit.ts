import expressRateLimit from 'express-rate-limit';

export const authRouteRateLimit = expressRateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
