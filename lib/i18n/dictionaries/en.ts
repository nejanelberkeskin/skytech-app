/**
 * EN dictionary — vitrin texts.
 * Mirrors the TR dictionary structure exactly. Keep in sync.
 */
import type { Dictionary } from "./tr";

const en: Dictionary = {
  meta: {
    siteName: "Skytech Green",
    siteTagline: "Plant the Future with Seed Balls",
  },
  nav: {
    home: "Home",
    services: "Services",
    seedBall: "Seed Ball",
    droneTech: "Drone Technology",
    carbonProgram: "Carbon Program",
    projects: "Projects",
    corporate: "Corporate",
    about: "About",
    contact: "Contact",
  },
  cta: {
    orderSeed: "Order Seeds",
    corporateSolutions: "Corporate Solutions",
    login: "Sign In",
    requestQuote: "Request a Quote",
    contactUs: "Contact Us",
    discover: "Explore",
    learnMore: "Learn More",
  },
  badges: {
    carbonNeutral: "Carbon Offsetting · Transparent · Measurable",
    coordinated: "Coordinated with Provincial Forestry Directorates",
    annualReporting: "Annual drone reporting",
    carbonCertificate: "Carbon certificate",
    comingSoon: "Coming Soon",
  },
  hero: {
    line1: "Plant the Future",
    line2: "with Seed Balls",
    description:
      "From post-fire zones to erosion-risk areas — fast, measurable and transparent reforestation powered by drone technology.",
  },
  footer: {
    services: "Services",
    quickLinks: "Quick Links",
    newsletter: "Join Our Newsletter",
    newsletterDesc: "For new projects and carbon offsetting updates.",
    subscribe: "Subscribe",
    rights: "All rights reserved.",
    company: "Skytech Green Technology Inc.",
    legal: {
      privacy: "Privacy Policy",
      terms: "Terms of Use",
      kvkk: "Data Protection (KVKK)",
      cookies: "Cookie Policy",
    },
  },
  status: {
    active: "Active",
    pilot: "Pilot",
    completed: "Completed",
  },
  developer: {
    badge: "Developers & API",
    title: "One-Line Seed Plugin",
    earlyAccess: "Join early access list",
  },
};

export default en;
