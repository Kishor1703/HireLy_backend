const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const {
    createJobLocation,
    allJobLocations,
    updateJobLocation,
    deleteJobLocation,
} = require("../controllers/jobLocationController");

router.post("/location/create", isAuthenticated, isAdmin, createJobLocation);
router.get("/location/jobs", allJobLocations);
router.put("/location/update/:location_id", isAuthenticated, isAdmin, updateJobLocation);
router.delete("/location/delete/:location_id", isAuthenticated, isAdmin, deleteJobLocation);

module.exports = router;
