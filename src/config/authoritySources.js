//anthony to add more authority sources time to time if needed
// src/config/authoritySources.js - Authoritative sources for content citations

module.exports = {
  // Management Consulting
  mckinsey: {
    name: 'McKinsey & Company',
    baseUrl: 'https://www.mckinsey.com',
    topics: ['strategy', 'growth', 'marketing', 'digital', 'operations'],
    paths: {
      insights: '/capabilities/growth-marketing-and-sales/our-insights',
      marketing: '/capabilities/marketing-and-sales/our-insights',
      digital: '/capabilities/mckinsey-digital/our-insights'
    }
  },
  
  bcg: {
    name: 'Boston Consulting Group',
    baseUrl: 'https://www.bcg.com',
    topics: ['innovation', 'digital', 'ai', 'customer', 'strategy'],
    paths: {
      publications: '/publications',
      customerInsights: '/capabilities/customer-insights/insights',
      marketingSales: '/capabilities/marketing-sales/insights',
      ai: '/capabilities/artificial-intelligence/insights',
      digitalTech: '/capabilities/digital-technology-data/insights'
    }
  },
  
  deloitte: {
    name: 'Deloitte Insights',
    baseUrl: 'https://www2.deloitte.com',
    topics: ['digital', 'analytics', 'cx', 'innovation', 'leadership'],
    paths: {
      insights: '/us/en/insights.html',
      digital: '/us/en/insights/focus/digital-transformation.html'
    }
  },
  
  // Research Firms
  gartner: {
    name: 'Gartner',
    baseUrl: 'https://www.gartner.com',
    topics: ['technology', 'marketing', 'digital', 'analytics', 'innovation'],
    paths: {
      marketing: '/en/marketing',
      insights: '/en/insights'
    }
  },
  
  forrester: {
    name: 'Forrester',
    baseUrl: 'https://www.forrester.com',
    topics: ['cx', 'customer experience', 'digital', 'b2b', 'marketing'],
    paths: {
      research: '/insights/latest-research/allTopics',
      cx: '/press-newsroom/forrester-cx-index'
    }
  },
  
  // Business Publications
  hbr: {
    name: 'Harvard Business Review',
    baseUrl: 'https://hbr.org',
    topics: ['leadership', 'strategy', 'innovation', 'management', 'marketing'],
    paths: {
      customerExperience: '/topic/customer-experience',
      strategy: '/topic/strategy',
      leadership: '/topic/leadership'
    }
  },
  
  mitSloan: {
    name: 'MIT Sloan Management Review',
    baseUrl: 'https://sloanreview.mit.edu',
    topics: ['innovation', 'digital', 'ai', 'strategy', 'leadership'],
    paths: {
      insights: '/topic/digital-transformation',
      ai: '/topic/artificial-intelligence'
    }
  },
  
  // Tech & Innovation
  techcrunch: {
    name: 'TechCrunch',
    baseUrl: 'https://techcrunch.com',
    topics: ['startups', 'innovation', 'technology', 'ai', 'digital'],
    paths: {
      asia: '/tag/asia'
    }
  },
  
  // Regional Sources
  techinasia: {
    name: 'Tech in Asia',
    baseUrl: 'https://www.techinasia.com',
    topics: ['startups', 'innovation', 'technology', 'APAC', 'Southeast Asia'],
    paths: {
      insights: '/insights'
    }
  },
  
  e27: {
    name: 'e27',
    baseUrl: 'https://e27.co',
    topics: ['startups', 'innovation', 'Southeast Asia', 'funding', 'technology'],
    paths: {
      insights: '/category/insights'
    }
  }
};