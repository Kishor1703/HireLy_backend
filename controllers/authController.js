const  User = require('../models/userModel');
const Application = require('../models/Application');
const ErrorResponse = require("../utils/errorResponse");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

const roleLabelByCode = {
    0: "employee",
    1: "admin",
    2: "jobPoster",
};

const getFrontendBaseUrl = () => (
    process.env.FRONTEND_ORIGIN ||
    process.env.CLIENT_URL ||
    "http://localhost:3000"
).replace(/\/+$/, "");

const buildVerificationEmail = (verificationUrl) => {
    const subject = "Verify your Talent Sphere account email";
    const text = `Welcome to Talent Sphere. Verify your email by clicking this link: ${verificationUrl}`;
    const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <h2 style="margin-bottom: 12px;">Verify your email</h2>
            <p style="margin: 0 0 12px;">Welcome to Talent Sphere. Click the button below to verify your email address.</p>
            <p style="margin: 20px 0;">
                <a href="${verificationUrl}" style="background:#1e4fd8;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">
                    Verify Email
                </a>
            </p>
            <p style="margin: 0;">If the button does not work, use this link:</p>
            <p style="word-break: break-all; margin: 8px 0 0;">${verificationUrl}</p>
        </div>
    `;

    return { subject, text, html };
};

const buildForgotPasswordEmail = (resetUrl) => {
    const subject = "Reset your Talent Sphere account password";
    const text = `Reset your password using this link: ${resetUrl}. This link expires in 30 minutes.`;
    const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <h2 style="margin-bottom: 12px;">Reset your password</h2>
            <p style="margin: 0 0 12px;">Click the button below to set a new password. This link expires in 30 minutes.</p>
            <p style="margin: 20px 0;">
                <a href="${resetUrl}" style="background:#1e4fd8;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">
                    Reset Password
                </a>
            </p>
            <p style="margin: 0;">If the button does not work, use this link:</p>
            <p style="word-break: break-all; margin: 8px 0 0;">${resetUrl}</p>
        </div>
    `;

    return { subject, text, html };
};

const sendVerificationEmailToUser = async (user) => {
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${getFrontendBaseUrl()}/verify-email?token=${verificationToken}`;
    const { subject, text, html } = buildVerificationEmail(verificationUrl);

    try {
        await sendEmail({
            to: user.email,
            subject,
            text,
            html
        });
    } catch (error) {
        console.error("Verification email send failed:", error && (error.message || error));
        // Keep the account created but return a clear actionable error.
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save({ validateBeforeSave: false });
        throw new ErrorResponse(
            "Account created, but verification email could not be sent. Please try resend verification.",
            500
        );
    }
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
            companyName: normalizedCompanyName || undefined,
            isEmailVerified: false
        });

        await sendVerificationEmailToUser(user);

        res.status(201).json({
            success: true,
            message: "Registration successful. Please verify your email before login.",
            user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
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

        // Backward compatibility: accounts created before email verification rollout
        // won't have isEmailVerified set. Auto-mark them verified on first successful login.
        if (typeof user.isEmailVerified === "undefined" || user.isEmailVerified === null) {
            user.isEmailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpire = undefined;
            await user.save({ validateBeforeSave: false });
        }

        if (!user.isEmailVerified) {
            return next(new ErrorResponse("Please verify your email before logging in.", 403));
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

exports.verifyEmail = async (req, res, next) => {
    try {
        const token = (req.query.token || req.body.token || "").trim();
        if (!token) {
            return next(new ErrorResponse("Verification token is required", 400));
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpire: { $gt: Date.now() }
        });

        if (!user) {
            return next(new ErrorResponse("Verification link is invalid or expired", 400));
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: "Email verified successfully. You can now log in."
        });
    } catch (error) {
        next(error);
    }
}

exports.resendVerificationEmail = async (req, res, next) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        if (!email) {
            return next(new ErrorResponse("please add email", 400));
        }

        const user = await User.findOne({ email });
        if (!user) {
            return next(new ErrorResponse("No account found with this email", 404));
        }

        if (user.isEmailVerified) {
            return res.status(200).json({
                success: true,
                message: "Email is already verified."
            });
        }

        await sendVerificationEmailToUser(user);

        res.status(200).json({
            success: true,
            message: "Verification email sent."
        });
    } catch (error) {
        next(error);
    }
}

exports.forgotPassword = async (req, res, next) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        if (!email) {
            return next(new ErrorResponse("please add email", 400));
        }

        const user = await User.findOne({ email });

        // Do not reveal whether the email exists.
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If an account with that email exists, a password reset link has been sent."
            });
        }

        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;
        const { subject, text, html } = buildForgotPasswordEmail(resetUrl);

        try {
            await sendEmail({
                to: user.email,
                subject,
                text,
                html
            });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return next(new ErrorResponse("Password reset email could not be sent. Please try again.", 500));
        }

        res.status(200).json({
            success: true,
            message: "If an account with that email exists, a password reset link has been sent."
        });
    } catch (error) {
        next(error);
    }
}

exports.resetPassword = async (req, res, next) => {
    try {
        const token = (req.params.token || req.body.token || "").trim();
        const password = (req.body.password || "").trim();
        const confirmPassword = (req.body.confirmPassword || "").trim();

        if (!token) {
            return next(new ErrorResponse("Reset token is required", 400));
        }
        if (!password) {
            return next(new ErrorResponse("please add password", 400));
        }
        if (password.length < 6) {
            return next(new ErrorResponse("password must have at least (6) caracters", 400));
        }
        if (confirmPassword && password !== confirmPassword) {
            return next(new ErrorResponse("Password and confirm password do not match", 400));
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return next(new ErrorResponse("Password reset token is invalid or expired", 400));
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password updated successfully. Please log in with your new password."
        });
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
