// ==========================================
// Vercel Serverless Function Entry Point
// Routes incoming serverless requests to the Express application
// ==========================================

const app = require('../backend/server');

module.exports = app;
