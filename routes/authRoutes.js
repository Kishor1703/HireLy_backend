const express = require("express");
const router = express.Router();
const { signup, signin, logout, userProfile, updateCompanyProfile } = require("../controllers/authController");
const { isAuthenticated } = require('../middleware/auth');


// auth routes
// /api/signup
router.post('/signup', signup);
router.post('/users/register', signup);

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
router.put('/me/company-profile', isAuthenticated, updateCompanyProfile);


module.exports = router;
