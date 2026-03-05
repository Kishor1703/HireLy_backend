const User = require('../models/userModel');
const Job = require('../models/jobModel');
const Application = require('../models/Application');
const ErrorResponse = require('../utils/errorResponse');

//load all users
exports.allUsers = async (req, res, next) => {
    try {
        const pageSize = Number(req.query.pageSize) || 10;
        const page = Number(req.query.pageNumber) || 1;
        const roleQuery = req.query.role;
        const keyword = (req.query.keyword || '').trim();
        const filter = {};

        if (roleQuery !== undefined && roleQuery !== '') {
            const parsedRole = Number(roleQuery);
            if (![0, 1, 2].includes(parsedRole)) {
                return next(new ErrorResponse('Invalid role filter', 400));
            }
            filter.role = parsedRole;
        }

        if (keyword) {
            filter.$or = [
                { firstName: { $regex: keyword, $options: 'i' } },
                { lastName: { $regex: keyword, $options: 'i' } },
                { email: { $regex: keyword, $options: 'i' } },
                { companyName: { $regex: keyword, $options: 'i' } }
            ];
        }

        const count = await User.countDocuments(filter);
        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .select('-password')
            .skip(pageSize * (page - 1))
            .limit(pageSize);

        res.status(200).json({
            success: true,
            users,
            page,
            pages: Math.ceil(count / pageSize),
            count

        })
    } catch (error) {
        return next(error);
    }
}

//show single user
exports.singleUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        res.status(200).json({
            success: true,
            user
        })

    } catch (error) {
        return next(error);
    }
}


//edit user
exports.editUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            success: true,
            user
        })

    } catch (error) {
        return next(error);
    }
}

//delete user
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        if (String(user._id) === String(req.user._id)) {
            return next(new ErrorResponse('Admin cannot delete own account', 400));
        }

        let deletedJobsCount = 0;
        let deletedApplicationsCount = 0;

        if (user.role === 2) {
            const posterJobs = await Job.find({ user: user._id }).select('_id');
            const posterJobIds = posterJobs.map((job) => job._id);

            if (posterJobIds.length > 0) {
                const deletedApps = await Application.deleteMany({ job: { $in: posterJobIds } });
                deletedApplicationsCount += deletedApps.deletedCount || 0;
            }

            const deletedJobs = await Job.deleteMany({ user: user._id });
            deletedJobsCount = deletedJobs.deletedCount || 0;
        }

        if (user.role === 0) {
            const deletedApps = await Application.deleteMany({ seeker: user._id });
            deletedApplicationsCount += deletedApps.deletedCount || 0;
        }

        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "User deleted",
            cleanup: {
                deletedJobsCount,
                deletedApplicationsCount
            }
        })

    } catch (error) {
        return next(error);
    }
}

// admin dashboard stats
exports.adminStats = async (req, res, next) => {
    try {
        const [employees, admins, companies, pendingCompanies, approvedCompanies, rejectedCompanies, verifiedCompanies, unverifiedCompanies, jobs, applications] = await Promise.all([
            User.countDocuments({ role: 0 }),
            User.countDocuments({ role: 1 }),
            User.countDocuments({ role: 2 }),
            User.countDocuments({ role: 2, companyApprovalStatus: 'pending' }),
            User.countDocuments({ role: 2, companyApprovalStatus: 'approved' }),
            User.countDocuments({ role: 2, companyApprovalStatus: 'rejected' }),
            User.countDocuments({ role: 2, companyVerified: true }),
            User.countDocuments({ role: 2, companyVerified: false }),
            Job.countDocuments({}),
            Application.countDocuments({})
        ]);

        res.status(200).json({
            success: true,
            stats: {
                employees,
                admins,
                companies,
                pendingCompanies,
                approvedCompanies,
                rejectedCompanies,
                verifiedCompanies,
                unverifiedCompanies,
                jobs,
                applications
            }
        });
    } catch (error) {
        return next(error);
    }
};

// admin: approve or reject a company account (job poster)
exports.updateCompanyApproval = async (req, res, next) => {
    try {
        const status = String(req.body.status || '').toLowerCase().trim();
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return next(new ErrorResponse('Invalid approval status', 400));
        }

        const companyUser = await User.findById(req.params.id).select('-password');
        if (!companyUser) {
            return next(new ErrorResponse('Company user not found', 404));
        }
        if (companyUser.role !== 2) {
            return next(new ErrorResponse('Target user is not a company account', 400));
        }

        companyUser.companyApprovalStatus = status;
        await companyUser.save();

        res.status(200).json({
            success: true,
            message: `Company status updated to ${status}`,
            user: companyUser
        });
    } catch (error) {
        return next(error);
    }
};

// admin: set company verification badge status
exports.updateCompanyVerification = async (req, res, next) => {
    try {
        const isVerified = req.body.verified;
        if (typeof isVerified !== 'boolean') {
            return next(new ErrorResponse('verified must be a boolean', 400));
        }

        const companyUser = await User.findById(req.params.id).select('-password');
        if (!companyUser) {
            return next(new ErrorResponse('Company user not found', 404));
        }
        if (companyUser.role !== 2) {
            return next(new ErrorResponse('Target user is not a company account', 400));
        }

        companyUser.companyVerified = isVerified;
        await companyUser.save();

        res.status(200).json({
            success: true,
            message: isVerified ? 'Company marked as verified' : 'Company marked as unverified',
            user: companyUser
        });
    } catch (error) {
        return next(error);
    }
};

//jobs history
exports.createUserJobsHistory = async (req, res, next) => {
    const { jobId, title, description, salary, location } = req.body;

    try {
        const currentUser = await User.findOne({ _id: req.user._id });
        if (!currentUser) {
            return next(new ErrorResponse("You must log In", 401));
        } else {
            // Ensure currentUser.jobsHistory is initialized as an array
            if (!currentUser.jobsHistory) {
                currentUser.jobsHistory = [];
            }
            
            const addJobHistory = {
                jobId,
                title,
                description,
                salary,
                location,
                user: req.user._id
            };
            
            // Push new job history into currentUser.jobsHistory
            currentUser.jobsHistory.push(addJobHistory);
            await currentUser.save();
        }

        res.status(200).json({
            success: true,
            currentUser
        });

    } catch (error) {
        return next(error);
    }
};
