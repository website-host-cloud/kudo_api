const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const cors = require('cors'); // 1. Added the CORS package
require('dotenv').config();

const app = express();

// 2. Enable CORS (This is the magic line that fixes your error!)
app.use(cors());

const PORT = process.env.PORT || 3000;

// Limit payload size to slightly mitigate DoS
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname)));

// API Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// MongoDB Connection
// Note: Make sure MONGODB_URI is set in your Render Environment Variables!
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kudo_registration';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error. Please make sure MongoDB is running.', err));

// MongoDB Schema & Model
const registrationSchema = new mongoose.Schema({
  timestampISO: { type: String },
  timestampLocal: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  program: { type: String, required: true },
  message: { type: String }
});

const Registration = mongoose.model('Registration', registrationSchema);

// Apply rate limiter specifically to the registration route
app.post('/api/register', apiLimiter, async (req, res) => {
  try {
    const { ts, name, email, phone, program, message } = req.body || {};

    if (!name || !email || !phone || !program) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Basic HTML sanitizer for XSS prevention
    const escapeHTML = str => {
      if (!str) return '';
      return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[tag]));
    };

    const iso = ts || new Date().toISOString();
    const dt = new Date(iso);
    const localTime = Number.isNaN(dt.valueOf()) ? '' : dt.toLocaleString();

    const newDoc = new Registration({
      timestampISO: iso,
      timestampLocal: localTime,
      name: escapeHTML(name),
      email: escapeHTML(email),
      phone: escapeHTML(phone),
      program: escapeHTML(program),
      message: escapeHTML(message)
    });

    await newDoc.save();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error saving registration:', err);
    return res.status(500).json({ error: 'Failed to save registration.' });
  }
});

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>404 — Page Not Found</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050608;color:#fff;font-family:'Poppins',system-ui,sans-serif;text-align:center}
      h1{font-size:72px;margin:0;background:linear-gradient(135deg,#ff4040,#b3001f);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      p{color:rgba(255,255,255,.68);margin:8px 0 24px}
      a{display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#ff4040,#b3001f);color:#fff;text-decoration:none;border-radius:14px;font-weight:700;transition:transform .2s}
      a:hover{transform:translateY(-2px)}
    </style></head>
    <body><div><h1>404</h1><p>This page doesn't exist.</p><a href="/">← Back to Home</a></div></body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Erode District Kudo Sports Association API running on port ${PORT}`);
});
