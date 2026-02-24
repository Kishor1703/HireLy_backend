const express = require("express");
const router = express.Router();
const {
    createJob,
    singleJob,
    updateJob,
    showJobs,
    getPosterJobs,
    updatePosterJob,
    deletePosterJob
} = require('../controllers/jobsController');
const {isAuthenticated, isAdmin, isJobPosterOrAdmin} = require('../middleware/auth');


// jobs routes

// /api/job/create
router.post('/job/create', isAuthenticated, isJobPosterOrAdmin, createJob);

// /api/job/id
router.get('/job/:id', singleJob);

// /api/job/update/job_id
router.put('/job/update/:job_id', isAuthenticated, isAdmin, updateJob);

// /api/jobs/show
router.get('/jobs/show', showJobs);

// /api/poster/jobs
router.get('/poster/jobs', isAuthenticated, isJobPosterOrAdmin, getPosterJobs);

// /api/poster/jobs/job_id
router.put('/poster/jobs/:job_id', isAuthenticated, isJobPosterOrAdmin, updatePosterJob);
router.delete('/poster/jobs/:job_id', isAuthenticated, isJobPosterOrAdmin, deletePosterJob);


module.exports = router;
