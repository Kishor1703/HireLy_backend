const JobLocation = require("../models/jobLocationModel");
const Job = require("../models/jobModel");
const ErrorResponse = require("../utils/errorResponse");

exports.createJobLocation = async (req, res, next) => {
    try {
        const locationName = (req.body.locationName || "").trim();

        if (!locationName) {
            return next(new ErrorResponse("Location name is required", 400));
        }

        const existing = await JobLocation.findOne({
            locationName: new RegExp(`^${locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });

        if (existing) {
            return next(new ErrorResponse("Location already exists", 400));
        }

        const jobLocation = await JobLocation.create({
            locationName,
            user: req.user.id,
        });

        res.status(201).json({
            success: true,
            jobLocation,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return next(new ErrorResponse("Location already exists", 400));
        }
        next(error);
    }
};

exports.allJobLocations = async (req, res, next) => {
    try {
        const jobLocations = await JobLocation.find().sort({ locationName: 1 });
        res.status(200).json({
            success: true,
            jobLocations,
        });
    } catch (error) {
        next(error);
    }
};

exports.updateJobLocation = async (req, res, next) => {
    try {
        const locationName = (req.body.locationName || "").trim();

        if (!locationName) {
            return next(new ErrorResponse("Location name is required", 400));
        }

        const duplicate = await JobLocation.findOne({
            _id: { $ne: req.params.location_id },
            locationName: new RegExp(`^${locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        });

        if (duplicate) {
            return next(new ErrorResponse("Location already exists", 400));
        }

        const jobLocation = await JobLocation.findByIdAndUpdate(
            req.params.location_id,
            { locationName },
            { new: true, runValidators: true }
        );

        if (!jobLocation) {
            return next(new ErrorResponse("Job location not found", 404));
        }

        const relatedJobs = await Job.find({ locations: jobLocation._id })
            .populate('locations', 'locationName');

        await Promise.all(
            relatedJobs.map((job) => {
                const locationLabel = (job.locations || [])
                    .map((item) => item?.locationName)
                    .filter(Boolean)
                    .join(", ");

                return Job.findByIdAndUpdate(job._id, {
                    location: locationLabel,
                });
            })
        );

        res.status(200).json({
            success: true,
            jobLocation,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return next(new ErrorResponse("Location already exists", 400));
        }
        next(error);
    }
};

exports.deleteJobLocation = async (req, res, next) => {
    try {
        const isInUse = await Job.exists({ locations: req.params.location_id });
        if (isInUse) {
            return next(new ErrorResponse("Location is used in posted jobs and cannot be deleted", 400));
        }

        const jobLocation = await JobLocation.findByIdAndDelete(req.params.location_id);
        if (!jobLocation) {
            return next(new ErrorResponse("Job location not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Job location deleted",
        });
    } catch (error) {
        next(error);
    }
};
