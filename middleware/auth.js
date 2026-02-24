 const ErrorResponse = require("../utils/errorResponse");
 const jwt = require('jsonwebtoken');
 const User = require("../models/userModel");

 // check is user is authenticated
 exports.isAuthenticated = async (req, res, next) =>{
    const { token } = req.cookies;
    // make sre token exists
    if(!token){
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
    // try {
    //     // verify token
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //     req.user = await User.findById(decoded.id);
    //     next();
    // } 
    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user by ID
        const user = await User.findById(decoded.id);

        // If user not found
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        // Attach user object to request
        req.user = user;
        next();
    } 
    catch (error) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
 }

// middleware for admin
exports.isAdmin = (req, res, next) => {
    if(req.user.role !== 1){
        return next(new ErrorResponse('Access denied, you must an admin',401));
    }
    next();
}

// middleware for job poster or admin
exports.isJobPosterOrAdmin = (req, res, next) => {
    if (req.user.role !== 2 && req.user.role !== 1) {
        return next(new ErrorResponse('Access denied, you must be a job poster or admin', 403));
    }
    next();
}

// middleware for employees
exports.isEmployee = (req, res, next) => {
    if (req.user.role !== 0) {
        return next(new ErrorResponse('Access denied, employees only', 403));
    }
    next();
}
