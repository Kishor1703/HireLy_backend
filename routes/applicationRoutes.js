const express = require('express');
const { applyToJob, getPosterApplications, getSeekerApplications, updateApplicationStatus } = require('../controllers/applicationController');
const { isAuthenticated, isEmployee, isJobPosterOrAdmin } = require('../middleware/auth');
const router = express.Router();

router.post('/', isAuthenticated, isEmployee, applyToJob);
router.get('/me', isAuthenticated, isEmployee, getSeekerApplications);
router.get('/', isAuthenticated, isJobPosterOrAdmin, getPosterApplications);
router.get('/poster', isAuthenticated, isJobPosterOrAdmin, getPosterApplications);
router.patch('/:id/status', isAuthenticated, updateApplicationStatus);

module.exports = router;
