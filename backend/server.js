require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const voterRoutes = require('./routes/voterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const voteRoutes = require('./routes/voteRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const committeeRoutes = require('./routes/committeeRoutes');
const resultsRoutes = require('./routes/resultsRoutes');

const app = express();

// CORS configuration for faster preflight caching
app.use(cors({
  // origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  origin: ['https://an-elections-app.vercel.app/'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection with optimized settings
const mongoOptions = {
  maxPoolSize: 10, // Connection pool size
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false // Disable mongoose buffering for better error handling
};

if(!process.env.MONGODB_URI)
{
  console.error('Mongo URI Missing!');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, mongoOptions)
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database:', mongoose.connection.name);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
});

// Routes
app.use('/api/voters', voterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/results', resultsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Election API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
// Port updated to 5001
app.listen(PORT, () => {
  console.log(`Election API server running on http://localhost:${PORT}`);
});
