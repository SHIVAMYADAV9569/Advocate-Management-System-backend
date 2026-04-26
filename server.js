const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/hearings', require('./routes/hearings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/advocates', require('./routes/advocateRoutes'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/ai-assistant', require('./routes/aiAssistant'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Basic route
app.get('/', (req, res) => {
  res.send('Advocate Management System API');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
