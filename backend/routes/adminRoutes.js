const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public route
router.post('/login', adminController.loginAdmin);

// Protected routes
router.get('/profile', verifyToken, isAdmin, adminController.getAdminProfile);
router.put('/election/:electionId/status', verifyToken, isAdmin, adminController.setElectionStatus);
router.get('/election/:electionId/status', verifyToken, isAdmin, adminController.getElectionStatus);
router.put('/election/:electionId/schedule', verifyToken, isAdmin, adminController.updateElectionSchedule);
router.post('/election/:electionId/reset', verifyToken, isAdmin, adminController.resetElection);

module.exports = router;
