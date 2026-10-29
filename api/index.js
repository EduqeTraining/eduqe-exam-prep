// Eduqe Vercel Serverless Function Handler
// Routes all /api/* requests to the authoritative Eduqe backend engine

const { handleRequest } = require('../src/server');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
