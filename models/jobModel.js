const mongoose = require("mongoose");
const {ObjectId} = mongoose.Schema;

const applicationFieldSchema = new mongoose.Schema({
    id: {
        type: String,
        trim: true,
        required: true,
    },
    label: {
        type: String,
        trim: true,
        required: true,
        maxlength: 120,
    },
    type: {
        type: String,
        enum: ['text', 'email', 'number', 'textarea', 'select', 'date', 'file'],
        required: true,
    },
    required: {
        type: Boolean,
        default: false,
    },
    enabled: {
        type: Boolean,
        default: true,
    },
    system: {
        type: Boolean,
        default: false,
    },
    options: [{
        type: String,
        trim: true,
    }],
    placeholder: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
    },
}, { _id: false });

const jobSchema = new mongoose.Schema({
    title : {
        type: String,
        trim: true,
        required: [true, "Title is required"],
        maxlength: 70,
    },

    description : {
        type: String,
        trim: true,
        required: [true, "Description is required"],
    },

    salary : {
        type: String,
        trim: true,
        required: [true, "Salary is required"],
    },

    location : {
        type: String,
        trim: true,
        default: "",
    },

    locations: [{
        type: ObjectId,
        ref: "JobLocation",
    }],

    available : {
        type: Boolean,
        default: true,
    },

    jobType : {
        type: ObjectId,
        ref: "JobType",
        required: true
    },

    user : {
        type: ObjectId,
        ref: "User",
        required: true
    },
    companyName: {
        type: String,
        trim: true,
        maxlength: 120
    },
    companyLogo: {
        type: String,
        trim: true
    },
    applicationForm: {
        type: [applicationFieldSchema],
        default: undefined,
    },

}, {timestamps:true})

module.exports = mongoose.model("Job", jobSchema);
