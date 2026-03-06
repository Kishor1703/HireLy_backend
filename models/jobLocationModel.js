const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const jobLocationSchema = new mongoose.Schema({
    locationName: {
        type: String,
        trim: true,
        required: [true, "Job location is required"],
        maxlength: 120,
    },
    user: {
        type: ObjectId,
        ref: "User",
        required: true,
    },
}, { timestamps: true });

jobLocationSchema.index({ locationName: 1 }, { unique: true });

module.exports = mongoose.model("JobLocation", jobLocationSchema);
