const Job = require('../models/jobModel');
const JobType = require('../models/jobTypeModel');
const ErrorResponse = require('../utils/errorResponse');

// create job 
exports.createJob = async(req, res, next) => {
    try {
        let companyName = (req.body.companyName || "").trim();
        let companyLogo = (req.body.companyLogo || "").trim();

        if (req.user.role === 2) {
            const companyApprovalStatus = req.user.companyApprovalStatus || 'approved';
            if (companyApprovalStatus !== 'approved') {
                return next(new ErrorResponse("Your company is not approved yet. Please wait for admin approval.", 403));
            }

            companyName = (req.user.companyName || companyName || "").trim();
            companyLogo = (req.user.companyLogo || companyLogo || "").trim();
            if (!companyName) {
                return next(new ErrorResponse("Company profile is incomplete. Add company name before posting jobs.", 400));
            }
        }

        const job = await Job.create({
            title: req.body.title,
            description: req.body.description,
            salary: req.body.salary,
            location: req.body.location,
            jobType: req.body.jobType,
            user: req.user.id,
            companyName,
            companyLogo
        });
        res.status(201).json({
            success: true,
            job
        })
    } catch (error) {
        next(error);
    }
}

// single job 
exports.singleJob = async(req, res, next) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('jobType', 'jobTypeName')
            .populate('user', 'firstName lastName email companyName companyProfile companyLogo companyVerified');
        res.status(200).json({
            success: true,
            job
        })
    } catch (error) {
        next(error);
    }
}

// update job by id 
exports.updateJob = async(req, res, next) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.job_id, req.body, {new: true}).populate('jobType', 'jobTypeName').populate('user', 'firstName lastName');
        res.status(200).json({
            success: true,
            job
        })
    } catch (error) {
        next(error);
    }
}

// show jobs
exports.showJobs = async(req, res, next) => {

    // enable search
    const keyword = req.query.keyword ? {
        title: {
            $regex: req.query.keyword,
            $options: 'i'
        }
    } : {}

    // filter jobs by category ids
    let ids = [];
    const jobTypeCategory = await JobType.find({}, {_id:1});
    jobTypeCategory.forEach(cat =>{
        ids.push(cat._id);
    })

    const cat = req.query.cat;
    const location = (req.query.location || '').trim();

    const baseFilters = { ...keyword };

    if (cat) {
        baseFilters.jobType = cat;
    } else if (ids.length) {
        baseFilters.jobType = { $in: ids };
    }

    const filters = { ...baseFilters };

    if (location) {
        filters.location = new RegExp(`^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }


    // enable pagination
    const pageSize = 5;
    const page = Number(req.query.pageNumber) || 1;

    try {
        const locationRows = await Job.find(baseFilters, { location: 1, _id: 0 }).lean();
        const setUniqueLocation = [...new Set(
            locationRows
                .map((row) => (row.location || '').trim())
                .filter(Boolean)
        )];

        const count = await Job.countDocuments(filters);
        const jobs = await Job.find(filters)
            .populate('jobType', 'jobTypeName')
            .populate('user', 'companyName companyLogo companyVerified')
            .sort({createdAt: -1})
            .skip(pageSize*(page-1))
            .limit(pageSize);
        res.status(200).json({
            success: true,
            jobs,
            page,
            pages: Math.ceil(count/pageSize),
            count,
            setUniqueLocation
        
        })
    } catch (error) {
        next(error);
    }
}

// job poster: list own posted jobs
exports.getPosterJobs = async (req, res, next) => {
    try {
        if (req.user.role !== 2) {
            return next(new ErrorResponse("Only job posters can access this resource", 403));
        }

        const jobs = await Job.find({ user: req.user.id })
            .populate('jobType', 'jobTypeName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: jobs.length,
            jobs
        });
    } catch (error) {
        next(error);
    }
};

// job poster: update own job
exports.updatePosterJob = async (req, res, next) => {
    try {
        if (req.user.role !== 2) {
            return next(new ErrorResponse("Only job posters can update jobs", 403));
        }
        const companyApprovalStatus = req.user.companyApprovalStatus || 'approved';
        if (companyApprovalStatus !== 'approved') {
            return next(new ErrorResponse("Your company is not approved yet. Please wait for admin approval.", 403));
        }

        const job = await Job.findById(req.params.job_id);
        if (!job) {
            return next(new ErrorResponse("Job not found", 404));
        }

        if (String(job.user) !== String(req.user.id)) {
            return next(new ErrorResponse("You are not allowed to update this job", 403));
        }

        const allowedFields = ['title', 'description', 'salary', 'location', 'jobType'];
        const payload = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) payload[field] = req.body[field];
        });

        // Keep company fields aligned with poster profile.
        payload.companyName = (req.user.companyName || "").trim();
        payload.companyLogo = (req.user.companyLogo || "").trim();

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.job_id,
            payload,
            { new: true, runValidators: true }
        ).populate('jobType', 'jobTypeName');

        res.status(200).json({
            success: true,
            job: updatedJob
        });
    } catch (error) {
        next(error);
    }
};

// job poster: delete own job
exports.deletePosterJob = async (req, res, next) => {
    try {
        if (req.user.role !== 2) {
            return next(new ErrorResponse("Only job posters can delete jobs", 403));
        }

        const job = await Job.findById(req.params.job_id);
        if (!job) {
            return next(new ErrorResponse("Job not found", 404));
        }

        if (String(job.user) !== String(req.user.id)) {
            return next(new ErrorResponse("You are not allowed to delete this job", 403));
        }

        await Job.findByIdAndDelete(req.params.job_id);

        res.status(200).json({
            success: true,
            message: "Job deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
