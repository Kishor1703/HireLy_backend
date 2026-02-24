const  User = require('../models/userModel');
const Application = require('../models/Application');
const ErrorResponse = require("../utils/errorResponse");

const roleLabelByCode = {
    0: "employee",
    1: "admin",
    2: "jobPoster",
};


exports.signup = async (req, res, next)=>{
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        if (!email) {
            return next(new ErrorResponse("please add email", 403));
        }

        const userExist = await User.findOne({ email });
        if(userExist){
            return next(new ErrorResponse("Email already registered", 400));
        }

        // Public registration can create employee/job poster accounts only.
        const requestedRole = Number(req.body.role);
        const role = requestedRole === 2 ? 2 : 0;
        const normalizedCompanyName = (req.body.companyName || "").trim();

        if (role === 2 && !normalizedCompanyName) {
            return next(new ErrorResponse("Company name is required for job poster accounts", 400));
        }

        const user = await User.create({
            ...req.body,
            email,
            role,
            companyName: normalizedCompanyName || undefined
        });
        res.status(201).json({
            success: true,
            user
        })
    } catch (error) {
        next(error);
    }
}

exports.signin = async (req, res, next)=>{
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const { password, loginType } = req.body;
        const companyName = (req.body.companyName || "").trim();
        // validation
        if(!email){
            return next(new ErrorResponse("please add email", 403));
        }
        if(!password){
            return next(new ErrorResponse("please add password", 403));
        }

        //check user email
        const user = await User.findOne({email});
        if(!user){
            return next(new ErrorResponse("invalid credentials", 400));
        }
        const isMatch = await user.comparePassword(password);
        if(!isMatch){
            return next(new ErrorResponse("invalid credentials", 400));
        }

        const roleByLoginType = {
            employee: 0,
            admin: 1,
            jobPoster: 2
        };

        if (loginType && roleByLoginType[loginType] !== undefined && user.role !== roleByLoginType[loginType]) {
            return next(new ErrorResponse(`This account is not a ${loginType} account`, 403));
        }

        if (loginType === "jobPoster") {
            if (!companyName) {
                return next(new ErrorResponse("Please enter your company name", 400));
            }
            if (!user.companyName) {
                user.companyName = companyName;
                await user.save();
            } else if (user.companyName.trim().toLowerCase() !== companyName.toLowerCase()) {
                return next(new ErrorResponse("Company name does not match this account", 403));
            }
        }

        sendTokenResponse(user, 200, res);


    } catch (error) {
        next(error);
    }
}

const sendTokenResponse = async(user, codeStatus, res) =>{
    const token = await user.getJwtToken();
    const isProduction = process.env.NODE_ENV === "production";
    res
    .status(codeStatus)
    .cookie('token', token, {
        maxAge: 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax"
    })
    .json({
        success: true,  
        token,
        role: user.role,
        roleLabel: roleLabelByCode[user.role]
    })
}

// logout 
exports.logout = (req,res, next) => {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax"
    });
    res.status(200).json({
        success: true,
        message: "logged out"
    })
}

// user profile
exports.userProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return next(new ErrorResponse("User not found", 404));
        }

        const needsProfileFallback = !user.phone || !user.resume;
        if (needsProfileFallback) {
            const latestApplication = await Application.findOne({ seeker: req.user.id })
                .sort({ createdAt: -1 })
                .select('firstName lastName email phone resume');

            if (latestApplication) {
                if (!user.firstName && latestApplication.firstName) user.firstName = latestApplication.firstName;
                if (!user.lastName && latestApplication.lastName) user.lastName = latestApplication.lastName;
                if (!user.email && latestApplication.email) user.email = latestApplication.email;
                if (!user.phone && latestApplication.phone) user.phone = latestApplication.phone;
                if (!user.resume && latestApplication.resume) user.resume = latestApplication.resume;
            }
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
}

exports.updateUserProfile = async (req, res, next) => {
    try {
        const firstName = (req.body.firstName || "").trim();
        const lastName = (req.body.lastName || "").trim();
        const email = (req.body.email || "").trim().toLowerCase();
        const phone = (req.body.phone || "").trim();
        const resume = (req.body.resume || "").trim();

        if (!firstName || !lastName || !email) {
            return next(new ErrorResponse("First name, last name, and email are required", 400));
        }

        const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
        if (existingUser) {
            return next(new ErrorResponse("Email already registered", 400));
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                firstName,
                lastName,
                email,
                phone,
                resume
            },
            { new: true, runValidators: true }
        ).select("-password");

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
}

exports.updateCompanyProfile = async (req, res, next) => {
    try {
        if (req.user.role !== 2) {
            return next(new ErrorResponse("Only job posters can update company profile", 403));
        }

        const companyName = (req.body.companyName || "").trim();
        const companyProfile = (req.body.companyProfile || "").trim();
        const companyLogo = (req.body.companyLogo || "").trim();

        if (!companyName) {
            return next(new ErrorResponse("Company name is required", 400));
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                companyName,
                companyProfile,
                companyLogo
            },
            { new: true, runValidators: true }
        ).select("-password");

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
}
