const express = require('express');
const { createJob, showJobs } = require('../controllers/jobsController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createJob);
router.get('/', showJobs);

module.exports = router;
