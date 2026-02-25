require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve Index.html from same directory

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI).then(() => console.log("Connected to MongoDB -> ", MONGODB_URI.split('@')[1] || MONGODB_URI))
    .catch(err => console.error("MongoDB connection error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

// Game Result Schema - explicit collection name "Temple Run"
const GameResultSchema = new mongoose.Schema({
    mobile: String,
    score: Number,
    category: String,
    date: { type: Date, default: Date.now }
}, { collection: 'Temple Run' });
const GameResult = mongoose.model('GameResult', GameResultSchema);

app.post('/api/signup', async (req, res) => {
    try {
        const { username, mobile, email } = req.body;
        if (!username || !mobile || !email) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        if (mobile.length !== 10) {
            return res.status(400).json({ error: 'Valid 10 digit mobile is required.' });
        }
        let existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this mobile already exists.' });
        }
        const newUser = new User({ username, mobile, email });
        await newUser.save();
        res.json({ success: true, user: newUser, hasPlayed: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({ error: 'Valid 10 digit mobile is required.' });
        }
        const user = await User.findOne({ mobile });
        if (user) {
            const pastResult = await GameResult.findOne({ mobile });
            res.json({ success: true, user, hasPlayed: !!pastResult, pastResult });
        } else {
            res.status(404).json({ error: 'You are not registered yet. Please click Sign Up to register and login.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/game-result', async (req, res) => {
    try {
        const { mobile, score, category } = req.body;
        const result = new GameResult({ mobile, score, category });
        await result.save();
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Endpoint to get all users and results
app.get('/api/admin/data', async (req, res) => {
    try {
        const users = await User.find({ isAdmin: { $ne: true } }).lean();
        const results = await GameResult.find({}).lean();

        // Combine the detailed data
        const combinedData = [];

        users.forEach(u => {
            const userResults = results.filter(r => r.mobile === u.mobile);
            if (userResults.length > 0) {
                userResults.forEach(r => {
                    combinedData.push({
                        username: u.username,
                        mobile: u.mobile,
                        email: u.email,
                        score: r.score,
                        category: r.category,
                        date: r.date
                    });
                });
            } else {
                combinedData.push({
                    username: u.username,
                    mobile: u.mobile,
                    email: u.email,
                    score: 'N/A',
                    category: 'Not Played Yet',
                    date: 'N/A'
                });
            }
        });

        res.json({ success: true, data: combinedData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
