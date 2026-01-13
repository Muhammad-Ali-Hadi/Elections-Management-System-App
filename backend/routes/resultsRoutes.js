const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');
const { adminAuth } = require('../middleware/auth');

// Get public election schedule status (no auth)
router.get('/:electionId/schedule-status', resultsController.getElectionScheduleStatus);

// Get current results (ongoing) - accessible to everyone
router.get('/:electionId', resultsController.getCurrentResults);

// Get flats that have voted (admin)
router.get('/:electionId/voted-flats', adminAuth, resultsController.getVotedFlats);

// Get results by position
router.get('/:electionId/position/:position', resultsController.getResultsByPosition);

// Declare/Finalize results - admin only
router.post('/:electionId/declare', adminAuth, resultsController.declareResults);

// Reject/cancel votes - admin only
router.post('/:electionId/reject', adminAuth, resultsController.rejectVotes);

// Get finalized results - accessible to everyone
router.get('/:electionId/finalized', resultsController.getFinalizedResults);

module.exports = router;
