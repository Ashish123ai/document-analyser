const request = require('supertest');
const app = require('../app');
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../utils/tokens');

// These tests cover everything that is decided BEFORE a database call
// (validation, auth gates, token typing), so they run without MongoDB.

describe('registration validation', () => {
  it('rejects a weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'asha@example.com', password: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'nope', password: 'Str0ngPass' });
    expect(res.status).toBe(422);
  });
});

describe('protected routes', () => {
  const protectedRoutes = [
    ['get', '/api/documents'],
    ['post', '/api/documents'],
    ['get', '/api/documents/507f1f77bcf86cd799439011'],
    ['get', '/api/chat'],
    ['get', '/api/dashboard/stats'],
    ['get', '/api/user/profile'],
    ['get', '/api/auth/validate'],
  ];

  it.each(protectedRoutes)('%s %s requires a token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/documents').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects a refresh token used as an access token', async () => {
    const { token } = signRefreshToken({ _id: '507f1f77bcf86cd799439011', tokenVersion: 0 });
    const res = await request(app).get('/api/documents').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

describe('token helpers', () => {
  const user = { _id: '507f1f77bcf86cd799439011', tokenVersion: 3 };

  it('round-trips access and refresh tokens with their claims', () => {
    const a = verifyAccessToken(signAccessToken(user).token);
    const r = verifyRefreshToken(signRefreshToken(user).token);
    expect(a.sub).toBe(user._id);
    expect(a.tv).toBe(3);
    expect(r.type).toBe('refresh');
  });

  it('does not accept an access token as a refresh token', () => {
    expect(() => verifyRefreshToken(signAccessToken(user).token)).toThrow();
  });
});

describe('misc', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
