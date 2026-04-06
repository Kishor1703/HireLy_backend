const mongoose = require('mongoose');

const applicationAnswerSchema = new mongoose.Schema({
  fieldId: { type: String, trim: true, required: true },
  label: { type: String, trim: true, required: true },
  type: { type: String, trim: true, required: true },
  value: { type: String, trim: true, default: '' },
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, trim: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, required: true },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  experienceLevel: {
    type: String,
    trim: true,
    enum: ['Fresher', 'Experienced', ''],
    default: '',
  },
  resume: { type: String, required: true },
  answers: { type: [applicationAnswerSchema], default: [] },
  status: {
    type: String,
    enum: ['pending', 'shortlisted', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
