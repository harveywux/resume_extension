// Field mapper - Maps HiHired resume data to job application form fields

export class FieldMapper {
  constructor(resumeData) {
    this.resume = resumeData || {};
    this.mapped = this.mapAllFields();
  }

  mapAllFields() {
    return {
      // Name fields
      firstName: this.extractFirstName(),
      lastName: this.extractLastName(),
      fullName: this.resume.name || '',

      // Contact fields
      email: this.resume.email || '',
      phone: this.formatPhone(this.resume.phone),
      phoneRaw: this.resume.phone || '',

      // Location fields
      ...this.parseLocation(),

      // Professional fields
      summary: this.resume.summary || '',
      skills: this.formatSkills(),
      skillsRaw: this.resume.skills || '',

      // Current/Most recent position
      currentTitle: this.getCurrentJobTitle(),
      currentCompany: this.getCurrentCompany(),
      yearsExperience: this.calculateYearsExperience(),

      // Education
      ...this.parseEducation(),

      // Links (if present in data)
      linkedin: this.extractLinkedIn(),
      github: this.extractGitHub(),
      website: this.extractWebsite(),

      // Raw data for complex fields
      experiences: this.resume.experiences || [],
      educationRaw: this.resume.education || ''
    };
  }

  extractFirstName() {
    const name = this.resume.name || '';
    const parts = name.trim().split(/\s+/);
    return parts[0] || '';
  }

  extractLastName() {
    const name = this.resume.name || '';
    const parts = name.trim().split(/\s+/);
    return parts.slice(1).join(' ') || '';
  }

  formatPhone(phone) {
    if (!phone) return '';

    // Remove non-digits
    const digits = phone.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for 10-digit US numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // Format with country code for 11 digits
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    // Return original if not standard format
    return phone;
  }

  parseLocation() {
    const location = this.resume.location || '';
    const parts = location.split(',').map(p => p.trim());

    return {
      city: parts[0] || '',
      state: parts[1] || '',
      country: parts[2] || 'United States',
      fullLocation: location,
      zipCode: '' // Not typically stored in resume data
    };
  }

  formatSkills() {
    const skills = this.resume.skills;

    if (Array.isArray(skills)) {
      return skills.join(', ');
    }

    if (typeof skills === 'string') {
      return skills;
    }

    return '';
  }

  getCurrentJobTitle() {
    const experiences = this.resume.experiences;

    if (!experiences || experiences.length === 0) {
      return '';
    }

    // Find currently working position first
    const current = experiences.find(e => e.currently_working || e.currentlyWorking);
    if (current) {
      return current.job_title || current.jobTitle || '';
    }

    // Otherwise return most recent
    return experiences[0].job_title || experiences[0].jobTitle || '';
  }

  getCurrentCompany() {
    const experiences = this.resume.experiences;

    if (!experiences || experiences.length === 0) {
      return '';
    }

    const current = experiences.find(e => e.currently_working || e.currentlyWorking);
    if (current) {
      return current.company || '';
    }

    return experiences[0].company || '';
  }

  calculateYearsExperience() {
    const experiences = this.resume.experiences;

    if (!experiences || experiences.length === 0) {
      return 0;
    }

    // Find earliest start date
    let earliest = new Date();

    for (const exp of experiences) {
      const startDate = exp.start_date || exp.startDate;
      if (startDate) {
        const start = new Date(startDate);
        if (start < earliest) {
          earliest = start;
        }
      }
    }

    const years = (Date.now() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.round(years);
  }

  parseEducation() {
    const education = this.resume.education || '';

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(education);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const latest = parsed[0];
        return {
          school: latest.school || latest.institution || '',
          degree: latest.degree || '',
          field: latest.field || latest.major || '',
          graduationYear: latest.graduationYear || latest.graduation_year || latest.year || '',
          gpa: latest.gpa || ''
        };
      }
    } catch (e) {
      // Parse as text - extract common patterns
      const degreeMatch = education.match(/(?:Bachelor|Master|PhD|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|MBA|Associate)/i);
      const yearMatch = education.match(/\b(19|20)\d{2}\b/);

      return {
        school: '',
        degree: degreeMatch ? degreeMatch[0] : '',
        field: '',
        graduationYear: yearMatch ? yearMatch[0] : '',
        gpa: ''
      };
    }

    return {
      school: '',
      degree: '',
      field: '',
      graduationYear: '',
      gpa: ''
    };
  }

  extractLinkedIn() {
    const pattern = /linkedin\.com\/in\/[\w-]+/i;
    const sources = [this.resume.summary, JSON.stringify(this.resume.experiences || [])];

    for (const source of sources) {
      if (source) {
        const match = source.match(pattern);
        if (match) return `https://${match[0]}`;
      }
    }

    return '';
  }

  extractGitHub() {
    const pattern = /github\.com\/[\w-]+/i;
    const sources = [this.resume.summary, JSON.stringify(this.resume.experiences || [])];

    for (const source of sources) {
      if (source) {
        const match = source.match(pattern);
        if (match) return `https://${match[0]}`;
      }
    }

    return '';
  }

  extractWebsite() {
    // Look for portfolio or personal website URLs
    const pattern = /https?:\/\/(?!linkedin|github|twitter|facebook)[^\s"'<>]+/i;

    if (this.resume.summary) {
      const match = this.resume.summary.match(pattern);
      if (match) return match[0];
    }

    return '';
  }

  // Get value for a specific field type
  getValue(fieldType) {
    return this.mapped[fieldType] || '';
  }

  // Get all mapped data
  getAllMapped() {
    return this.mapped;
  }
}

export default FieldMapper;
