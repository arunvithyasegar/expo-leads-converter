import React, { useState } from 'react';

export const LeadForm: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    orgType: '',
    objective: 'Win More Corporate RFPs'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refId, setRefId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required.';
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Valid work email is required.';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required.';
    if (!formData.company.trim()) newErrors.company = 'Organization is required.';
    if (!formData.orgType) newErrors.orgType = 'Please select organization type.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/lead-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          submittedAt: new Date().toISOString()
        })
      });
      const data = await res.json();
      setRefId(data.referenceId || `REQ-${Math.floor(100000 + Math.random() * 900000)}`);
      setSubmitted(true);
    } catch {
      setRefId(`DEMO-${Math.floor(100000 + Math.random() * 900000)}`);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="hero-lead-card">
        <div className="form-success-card active">
          <div className="success-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: '#0F172A', marginBottom: '8px' }}>
            Consultation Request Received!
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '16px' }}>
            Thank you for connecting. Our Director of Enterprise Transient Solutions has reserved your inquiry for <strong>{formData.company}</strong>.
          </p>
          <div style={{ background: '#F1F5F9', padding: '12px', borderRadius: '8px', fontSize: '0.8125rem', color: '#334155', marginBottom: '20px' }}>
            Reference Inquiry: <strong>{refId}</strong> • Direct priority briefing scheduled.
          </div>
          <button className="btn btn-secondary" onClick={() => setSubmitted(false)} style={{ fontSize: '0.85rem', width: '100%' }}>
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-lead-card" id="demo-form">
      <div className="lead-card-header">
        <h2 className="lead-card-title">{"Let's connect"}</h2>
        <p className="lead-card-subtitle">Speak with a corporate transient specialist and get custom compset market data for your properties.</p>
      </div>

      <form className="lead-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="reactFirstName">First name <span className="req">*</span></label>
            <input 
              id="reactFirstName"
              className={`form-input ${errors.firstName ? 'has-error' : ''}`}
              type="text" 
              value={formData.firstName}
              onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="Sarah" 
            />
            {errors.firstName && <span className="field-error-msg visible">{errors.firstName}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reactLastName">Last name <span className="req">*</span></label>
            <input 
              id="reactLastName"
              className={`form-input ${errors.lastName ? 'has-error' : ''}`}
              type="text" 
              value={formData.lastName}
              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Chen" 
            />
            {errors.lastName && <span className="field-error-msg visible">{errors.lastName}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reactEmail">Work email <span className="req">*</span></label>
          <input 
            id="reactEmail"
            className={`form-input ${errors.email ? 'has-error' : ''}`}
            type="email" 
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="sarah.chen@hotelbrand.com" 
          />
          {errors.email && <span className="field-error-msg visible">{errors.email}</span>}
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="reactCompany">Organization <span className="req">*</span></label>
            <input 
              id="reactCompany"
              className={`form-input ${errors.company ? 'has-error' : ''}`}
              type="text" 
              value={formData.company}
              onChange={e => setFormData({ ...formData, company: e.target.value })}
              placeholder="Grand Luxury Hotels" 
            />
            {errors.company && <span className="field-error-msg visible">{errors.company}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reactPhone">Phone <span className="req">*</span></label>
            <input 
              id="reactPhone"
              className={`form-input ${errors.phone ? 'has-error' : ''}`}
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 019-2834" 
            />
            {errors.phone && <span className="field-error-msg visible">{errors.phone}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reactOrgType">Organization type <span className="req">*</span></label>
          <select 
            id="reactOrgType"
            className={`form-select ${errors.orgType ? 'has-error' : ''}`}
            value={formData.orgType}
            onChange={e => setFormData({ ...formData, orgType: e.target.value })}
          >
            <option value="">Select organization type</option>
            <option value="Hotel Chain / Brand">Hotel Chain / Global Brand</option>
            <option value="Independent Property / Resort">Independent Property / Luxury Resort</option>
            <option value="Hotel Management Company">Hotel Management Company (HMC)</option>
            <option value="Destination / CVB">Destination / CVB / Tourism Board</option>
          </select>
          {errors.orgType && <span className="field-error-msg visible">{errors.orgType}</span>}
        </div>

        <button className="btn-submit-lead" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting Request...' : 'Get in touch \u2192'}
        </button>
      </form>
    </div>
  );
};
