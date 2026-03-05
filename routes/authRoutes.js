const express = require("express");
const router = express.Router();
const {
    signup,
    signin,
    logout,
    userProfile,
    updateUserProfile,
    updateCompanyProfile,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword
} = require("../controllers/authController");
const { isAuthenticated } = require('../middleware/auth');


// auth routes
// /api/signup
router.post('/signup', signup);
router.post('/users/register', signup);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password', resetPassword);

// /api/signin
router.post('/signin', signin);
router.post('/users/login', signin);
router.post('/admin/login', (req, res, next) => {
    req.body.loginType = 'admin';
    return signin(req, res, next);
});

// /api/signin
router.get('/logout', logout);

// /api/me
router.get('/me', isAuthenticated, userProfile);
router.put('/me/profile', isAuthenticated, updateUserProfile);
router.patch('/me/profile', isAuthenticated, updateUserProfile);
router.post('/me/profile', isAuthenticated, updateUserProfile);
router.put('/me/company-profile', isAuthenticated, updateCompanyProfile);


module.exports = router;
