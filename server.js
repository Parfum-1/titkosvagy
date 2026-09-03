const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'titkosvagy_biztonsagi_kulcs_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/forrovagy_db';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Adatbázis kapcsolat sikeresen létrejött.'))
  .catch(err => console.error('Adatbázis csatlakozási hiba:', err));

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  credits: { type: Number, default: 10 },
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
  if (!token) return res.status(401).json({ error: 'Hiányzó hozzáférési token!' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Érvénytelen vagy lejárt token!' });
    req.user = user;
    next();
  });
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, email, password } = req.body;
    if (!displayName || !email || !password) {
      return res.status(400).json({ error: 'Minden mező kitöltése kötelező!' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Ez az e-mail cím már regisztrálva van.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({ displayName, email, passwordHash });
    await newUser.save();

    res.status(201).json({ message: 'Sikeres regisztráció!' });
  } catch (err) {
    res.status(500).json({ error: 'Szerverhiba történt a regisztráció során.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Hibás e-mail cím vagy jelszó.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Hibás e-mail cím vagy jelszó.' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, displayName: user.displayName, credits: user.credits });
  } catch (err) {
    res.status(500).json({ error: 'Szerverhiba a bejelentkezéskor.' });
  }
});

app.get('/api/profiles', async (req, res) => {
  try {
    const { keyword, gender, minAge, maxAge, region } = req.query;
    let query = {};

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { city: { $regex: keyword, $options: 'i' } },
        { interests: { $regex: keyword, $options: 'i' } }
      ];
    }
    if (gender && gender !== 'Mindegy') {
      query.gender = gender;
    }
    if (region && region !== 'Összes megye / régió') {
      query.region = region;
    }
    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = Number(minAge);
      if (maxAge) query.age.$lte = Number(maxAge);
    }

    const profiles = await Profile.find(query);
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: 'Hiba a keresés során.' });
  }
});

app.post('/api/messages/send', authenticateToken, async (req, res) => {
  try {
    const { recipientId, messageText } = req.body;
    const user = await User.findById(req.user.userId);

    const messageCost = 6;
    if (user.credits < messageCost) {
      return res.status(400).json({ error: 'Nincs elegendő kredited az üzenet küldéséhez!' });
    }

    user.credits -= messageCost;
    await user.save();

    res.json({ success: true, remainingCredits: user.credits });
  } catch (err) {
    res.status(500).json({ error: 'Hiba az üzenetküldéskor.' });
  }
});

app.post('/api/photos/unlock', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const unlockCost = 10;

    if (user.credits < unlockCost) {
      return res.status(400).json({ error: 'Nincs elegendő kredited a kép feloldásához!' });
    }

    user.credits -= unlockCost;
    await user.save();

    res.json({ success: true, remainingCredits: user.credits });
  } catch (err) {
    res.status(500).json({ error: 'Hiba a kép feloldásakor.' });
  }
});

app.listen(PORT, () => {
  console.log(`A rendszer élesen fut a http://localhost:${PORT} címen.`);
});