const DEFAULT_APPLICATION_FIELDS = [
  { id: 'fullName', label: 'Full Name', type: 'text', required: true, enabled: true, system: true },
  { id: 'email', label: 'Email Address', type: 'email', required: true, enabled: true, system: true },
  { id: 'phone', label: 'Mobile Number', type: 'text', required: true, enabled: true, system: true },
  {
    id: 'experienceLevel',
    label: 'Experience Level',
    type: 'select',
    required: true,
    enabled: true,
    system: true,
    options: ['Fresher', 'Experienced'],
  },
  { id: 'resume', label: 'Resume', type: 'file', required: true, enabled: true, system: true },
  { id: 'location', label: 'Current Location', type: 'text', required: true, enabled: true, system: true },
];

const ALLOWED_FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'date', 'file'];
const SYSTEM_FIELD_IDS = DEFAULT_APPLICATION_FIELDS.map((field) => field.id);

const toKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const getDefaultApplicationForm = () => DEFAULT_APPLICATION_FIELDS.map((field) => ({
  ...field,
  options: Array.isArray(field.options) ? [...field.options] : [],
  placeholder: '',
}));

const normalizeApplicationForm = (rawFields) => {
  const fields = Array.isArray(rawFields) && rawFields.length ? rawFields : getDefaultApplicationForm();
  const normalized = [];
  const seenIds = new Set();

  fields.forEach((field, index) => {
    const source = field || {};
    const rawId = source.id || source.key || source.name || source.label || `field_${index + 1}`;
    let id = SYSTEM_FIELD_IDS.includes(rawId) ? rawId : toKey(rawId) || `field_${index + 1}`;
    if (seenIds.has(id)) {
      id = `${id}_${index + 1}`;
    }
    seenIds.add(id);

    const systemDefault = DEFAULT_APPLICATION_FIELDS.find((item) => item.id === id);
    const type = ALLOWED_FIELD_TYPES.includes(source.type) ? source.type : (systemDefault?.type || 'text');
    const options = type === 'select'
      ? (Array.isArray(source.options) ? source.options : []).map((option) => String(option || '').trim()).filter(Boolean)
      : [];

    normalized.push({
      id,
      label: String(source.label || systemDefault?.label || 'Field').trim() || 'Field',
      type,
      required: Boolean(source.required ?? systemDefault?.required),
      enabled: Boolean(source.enabled ?? true),
      system: Boolean(systemDefault),
      options,
      placeholder: String(source.placeholder || '').trim(),
    });
  });

  DEFAULT_APPLICATION_FIELDS.forEach((field) => {
    if (!normalized.some((item) => item.id === field.id)) {
      normalized.push({
        ...field,
        options: Array.isArray(field.options) ? [...field.options] : [],
        placeholder: '',
      });
    }
  });

  return normalized;
};

const validateApplicationForm = (rawFields) => {
  const form = normalizeApplicationForm(rawFields);
  const emailField = form.find((field) => field.id === 'email' && field.enabled);
  const resumeField = form.find((field) => field.id === 'resume' && field.enabled);

  if (!emailField || !emailField.required) {
    return { error: 'Email field must stay enabled and required', form };
  }

  if (!resumeField || !resumeField.required) {
    return { error: 'Resume field must stay enabled and required', form };
  }

  const invalidSelect = form.find((field) => field.enabled && field.type === 'select' && field.options.length === 0);
  if (invalidSelect) {
    return { error: `${invalidSelect.label} must have at least one option`, form };
  }

  return { form };
};

module.exports = {
  ALLOWED_FIELD_TYPES,
  DEFAULT_APPLICATION_FIELDS,
  SYSTEM_FIELD_IDS,
  getDefaultApplicationForm,
  normalizeApplicationForm,
  validateApplicationForm,
};
