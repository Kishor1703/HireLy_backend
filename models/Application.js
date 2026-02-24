const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: { type: String, trim: true, required: true },
  lastName: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, required: true },
  phone: { type: String, trim: true, required: true },
  resume: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
