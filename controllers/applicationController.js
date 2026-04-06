const Application = require('../models/Application');
const Job = require('../models/jobModel');
const User = require('../models/userModel');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');
const { getDefaultApplicationForm } = require('../utils/applicationForm');

const statusLabel = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
};

const buildApplicationStatusEmail = ({ firstName, jobTitle, status }) => {
  const readableStatus = statusLabel[status] || status;
  const subject = `Application update: ${readableStatus}`;
  const greetingName = (firstName || '').trim() || 'Candidate';
  const text = `Hi ${greetingName}, your application for "${jobTitle}" has been ${readableStatus.toLowerCase()}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">Application Status Updated</h2>
      <p style="margin: 0 0 12px;">Hi ${greetingName},</p>
      <p style="margin: 0 0 12px;">
        Your application for <strong>${jobTitle}</strong> has been
        <strong>${readableStatus}</strong>.
      </p>
      <p style="margin: 0;">Thank you for using Talent Sphere.</p>
    </div>
  `;

  return { subject, text, html };
};

// Apply to a Job
exports.applyToJob = async (req, res) => {
  const { jobId, answers } = req.body;
  const seekerId = req.user._id;

  try {
    if (!jobId) {
      return res.status(400).json({
        message: 'jobId is required',
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

    const formFields = (Array.isArray(job.applicationForm) && job.applicationForm.length
      ? job.applicationForm
      : getDefaultApplicationForm()).filter((field) => field.enabled);
    const incomingAnswers = (answers && typeof answers === 'object' && !Array.isArray(answers)) ? answers : {};
    const normalizedAnswers = [];

    for (const field of formFields) {
      const value = String(incomingAnswers[field.id] || '').trim();
      if (field.required && !value) {
        return res.status(400).json({ message: `${field.label} is required` });
      }
      if (field.type === 'select' && value && Array.isArray(field.options) && field.options.length && !field.options.includes(value)) {
        return res.status(400).json({ message: `Invalid value for ${field.label}` });
      }
      normalizedAnswers.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value,
      });
    }

    const answerMap = Object.fromEntries(normalizedAnswers.map((item) => [item.fieldId, item.value]));
    const fullName = String(answerMap.fullName || `${req.user.firstName || ''} ${req.user.lastName || ''}`).trim();
    const [applicantFirstName = '', ...restName] = fullName.split(/\s+/).filter(Boolean);
    const applicantLastName = restName.join(' ').trim();
    const applicantEmail = String(answerMap.email || req.user.email || '').trim().toLowerCase();
    const applicantPhone = String(answerMap.phone || '').trim();
    const applicantLocation = String(answerMap.location || '').trim();
    const applicantExperienceLevel = String(answerMap.experienceLevel || '').trim();
    const normalizedResume = String(answerMap.resume || '').trim();

    if (!applicantEmail || !normalizedResume) {
      return res.status(400).json({ message: 'Email and resume are required' });
    }

    const application = new Application({
      job: jobId,
      seeker: seekerId,
      fullName,
      firstName: applicantFirstName,
      lastName: applicantLastName,
      email: applicantEmail,
      phone: applicantPhone,
      location: applicantLocation,
      experienceLevel: applicantExperienceLevel,
      resume: normalizedResume,
      answers: normalizedAnswers,
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
    console.error('applyToJob failed:', err);
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

// Job poster - update status of an application received on own job
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 2) {
      return next(new ErrorResponse('Only job posters can update application status', 403));
    }

    const nextStatus = String(req.body.status || '').trim().toLowerCase();
    if (!['pending', 'shortlisted', 'rejected'].includes(nextStatus)) {
      return next(new ErrorResponse('Invalid application status', 400));
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return next(new ErrorResponse('Application not found', 404));
    }

    const job = await Job.findById(application.job).select('title user');
    if (!job) {
      return next(new ErrorResponse('Job not found for this application', 404));
    }

    if (String(job.user) !== String(req.user._id)) {
      return next(new ErrorResponse('You are not allowed to update this application', 403));
    }

    if (application.status === nextStatus) {
      return res.status(200).json({
        success: true,
        message: `Application already marked as ${nextStatus}`,
        application
      });
    }

    application.status = nextStatus;
    await application.save();

    try {
      const { subject, text, html } = buildApplicationStatusEmail({
        firstName: application.firstName,
        jobTitle: job.title || 'the selected role',
        status: nextStatus,
      });

      await sendEmail({
        to: application.email,
        subject,
        text,
        html
      });
    } catch (mailError) {
      console.error('Application status email failed:', mailError?.message || mailError);
    }

    await User.updateOne(
      {
        _id: application.seeker,
        'jobsHistory.jobId': application.job,
      },
      {
        $set: {
          'jobsHistory.$.applicationStatus': nextStatus,
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Application marked as ${nextStatus}`,
      application,
    });
  } catch (error) {
    next(error);
  }
};
