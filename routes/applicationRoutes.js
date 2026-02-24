const express = require('express');
const { applyToJob, getPosterApplications } = require('../controllers/applicationController');
const { isAuthenticated, isEmployee, isJobPosterOrAdmin } = require('../middleware/auth');
const router = express.Router();

router.post('/', isAuthenticated, isEmployee, applyToJob);
router.get('/', isAuthenticated, isJobPosterOrAdmin, getPosterApplications);
router.get('/poster', isAuthenticated, isJobPosterOrAdmin, getPosterApplications);

module.exports = router;
