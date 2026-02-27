const express = require("express");
const router = express.Router();
const { allUsers, singleUser, editUser, deleteUser, createUserJobsHistory, adminStats, updateCompanyApproval } = require("../controllers/userController");
const { isAuthenticated, isAdmin } = require('../middleware/auth');


// user routes


// /api/allUsers
router.get('/allUsers', isAuthenticated, isAdmin, allUsers);
router.get('/admin/users', isAuthenticated, isAdmin, allUsers);
router.get('/admin/stats', isAuthenticated, isAdmin, adminStats);
router.patch('/admin/company/:id/approval', isAuthenticated, isAdmin, updateCompanyApproval);

// /api/user/id
router.get('/user/:id', isAuthenticated, singleUser);

// /api/user/edit/id
router.put('/user/edit/:id', isAuthenticated, editUser);

// /api/admin/user/delete/id
router.delete('/admin/user/delete/:id', isAuthenticated, isAdmin, deleteUser);

// /api/user/jobhistory
router.post('/user/jobhistory', isAuthenticated, createUserJobsHistory);



module.exports = router;
