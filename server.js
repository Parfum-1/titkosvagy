const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'titkosvagy_biztonsagi_kulcs_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Multer konfiguráció 2 kép kezelésére (profilkép és zárt saját kép)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const dir = 'public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/forrovagy_db';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Adatbázis kapcsolat sikeres.'))
  .catch(err => console.error('Adatbázis hiba:', err));

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  credits: { type: Number, default: 10 },
  profileImage: { type: String, default: '' },
  privateImage: { type: String, default: '' },
  gender: { type: String, default: 'not_specified' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const profileSchema = new mongoose.Schema({
  name: String,
  age: Number,
  city: String,
  gender: String,
  region: String,
  interests: [String],
  image: String,
  isVirtual: { type: Boolean, default: false }
});
const Profile = mongoose.model('Profile', profileSchema);

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Hiányzó token!' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Érvénytelen token!' });
    req.user = user;
    next();
  });
}

// Auth végpontok
app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, email, password } = req.body;
    if (!displayName || !email || !password) return res.status(400).json({ error: 'Minden mező kötelező!' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Már létezik fiók ezzel az e-mail címmel.' });
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = new User({ displayName, email, passwordHash });
    await newUser.save();
    res.status(201).json({ message: 'Sikeres regisztráció!' });
  } catch (err) {
    res.status(500).json({ error: 'Szerverhiba.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Hibás adatok.' });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Hibás adatok.' });
    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, displayName: user.displayName, credits: user.credits });
  } catch (err) {
    res.status(500).json({ error: 'Szerverhiba.' });
  }
});

// Képfeltöltés végpont (2 kép)
app.post('/api/user/upload-photos', authenticateToken, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'privateImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (req.files['profileImage']) {
      user.profileImage = '/uploads/' + req.files['profileImage'][0].filename;
    }
    if (req.files['privateImage']) {
      user.privateImage = '/uploads/' + req.files['privateImage'][0].filename;
    }
    await user.save();
    res.json({ success: true, profileImage: user.profileImage, privateImage: user.privateImage });
  } catch (err) {
    res.status(500).json({ error: 'Hiba a képek feltöltésekor.' });
  }
});

// Stripe fizetési session
app.post('/api/payment/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { creditPackage } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'huf',
          product_data: { name: `${creditPackage} Kredit Csomag` },
          unit_amount: creditPackage * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?success=true&credits=${creditPackage}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?canceled=true`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Hiba a fizetés indításakor.' });
  }
});

app.listen(PORT, () => console.log(`Backend fut a ${PORT}-es porton.`));
