const Application = require('../models/Application');
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const ErrorResponse = require('../utils/errorResponse');

// Apply to a Job
exports.applyToJob = async (req, res) => {
  const { jobId, resume, firstName, lastName, email, phone } = req.body;
  const seekerId = req.user._id;
  const normalizedResume = String(resume || '').trim();

  try {
    if (!jobId || !normalizedResume) {
      return res.status(400).json({
        message: 'jobId and resume are required',
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const existing = await Application.findOne({ job: jobId, seeker: seekerId });
    if (existing) {
      return res.status(400).json({ message: 'You already applied for this job' });
    }

    const applicantFirstName = (firstName || req.user.firstName || '').trim();
    const applicantLastName = (lastName || req.user.lastName || '').trim();
    const applicantEmail = (email || req.user.email || '').trim().toLowerCase();
    const applicantPhone = (phone || 'Not provided').trim();

    if (!applicantFirstName || !applicantLastName || !applicantEmail) {
      return res.status(400).json({
        message: 'Applicant details are missing. Please complete your application details.',
      });
    }

    const application = new Application({
      job: jobId,
      seeker: seekerId,
      firstName: applicantFirstName,
      lastName: applicantLastName,
      email: applicantEmail,
      phone: applicantPhone,
      resume: normalizedResume,
    });
    await application.save();

    // Save latest application contact data to employee profile and keep history in sync.
    await User.findByIdAndUpdate(
      seekerId,
      {
        $set: {
          firstName: applicantFirstName,
          lastName: applicantLastName,
          email: applicantEmail,
          phone: applicantPhone,
          resume: normalizedResume,
        },
        $push: {
          jobsHistory: {
            jobId: job._id,
            title: job.title,
            description: job.description,
            salary: job.salary,
            location: job.location,
            companyName: job.companyName,
            companyLogo: job.companyLogo,
            applicationStatus: 'pending',
            user: seekerId,
          },
        },
      }
    );

    res.status(201).json({ message: 'Application submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Job poster - view applications received on own posted jobs
exports.getPosterApplications = async (req, res, next) => {
  try {
    if (req.user.role !== 2) {
      return next(new ErrorResponse('Only job posters can view these applications', 403));
    }

    const applications = await Application.find({})
      .populate({
        path: 'job',
        select: 'title location salary companyName companyLogo user',
        match: { user: req.user._id },
      })
      .sort({ createdAt: -1 });

    const filtered = applications.filter((app) => app.job);

    res.status(200).json({
      success: true,
      count: filtered.length,
      applications: filtered,
    });
  } catch (error) {
    next(error);
  }
};

// Employee - view own applications
exports.getSeekerApplications = async (req, res, next) => {
  try {
    if (req.user.role !== 0) {
      return next(new ErrorResponse('Only employees can view these applications', 403));
    }

    const applications = await Application.find({ seeker: req.user._id })
      .populate({
        path: 'job',
        select: 'title description location salary companyName companyLogo',
      })
      .sort({ createdAt: -1 });

    const filtered = applications.filter((app) => app.job);

    res.status(200).json({
      success: true,
      count: filtered.length,
      applications: filtered,
    });
  } catch (error) {
    next(error);
  }
};
