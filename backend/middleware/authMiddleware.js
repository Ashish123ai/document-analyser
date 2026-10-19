const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

// Protects a route: validates the Bearer JWT, checks it was not revoked (logout),
// and that the user's tokenVersion still matches (password change/reset).
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required', 'NO_TOKEN');
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Session expired', 'TOKEN_EXPIRED');
    throw new ApiError(401, 'Invalid token', 'INVALID_TOKEN');
  }

  if (await RevokedToken.exists({ jti: payload.jti })) {
    throw new ApiError(401, 'Session has been signed out', 'TOKEN_REVOKED');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'Session is no longer valid', 'TOKEN_INVALIDATED');
  }

  req.user = user;
  req.token = payload;
  next();
});

module.exports = { protect };
