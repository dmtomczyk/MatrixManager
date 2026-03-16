import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const principles = [
  {
    title: 'Organizations contain employees',
    body: 'An organization is the home structure for your people. Every employee belongs to one organization, even if they work across multiple projects.',
  },
  {
    title: 'Managers lead reporting trees',
    body: 'Employees with leader roles can manage people. Those direct reports can themselves be managers, giving you a hierarchy inside each organization.',
  },
  {
    title: 'Projects pull people across the org',
    body: 'Projects represent work demand. Assignments connect employees to projects with date ranges and allocation percentages so you can see utilization over time.',
  },
];

const steps = [
  'Define an organization',
  'Set up job codes',
  'Create employees',
  'Create a project',
  'Assign employees to the project',
  'Review the outputs in Canvas and Forecast',
];

const quickLinks = [
  { label: 'Organizations', href: '/orgs' },
  { label: 'Job Codes', href: '/job-codes' },
  { label: 'Employees', href: '/people' },
  { label: 'Projects', href: '/planning' },
  { label: 'Assignments', href: '/staffing' },
];

export default function GetStartedPage() {
  return (
    <main className="mm-home-shell">
      <Card className="mm-hero-card">
        <CardHeader>
          <CardTitle>How the model works</CardTitle>
          <CardDescription>
            Matrix Management connects organizations, people, projects, and assignments into one staffing picture.
          </CardDescription>
        </CardHeader>
        <CardContent className="mm-hero-grid">
          {principles.map((item) => (
            <article key={item.title} className="mm-feature-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="mm-home-grid">
        <Card>
          <CardHeader>
            <CardTitle>Relationship map</CardTitle>
            <CardDescription>Use this as the mental model for the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mm-flow-row">
              <div className="mm-flow-pill"><strong>Organizations</strong><span>Foundation</span></div>
              <div className="mm-flow-arrow">→</div>
              <div className="mm-flow-pill"><strong>Employees</strong><span>People</span></div>
              <div className="mm-flow-arrow">→</div>
              <div className="mm-flow-pill"><strong>Managers</strong><span>Structure</span></div>
              <div className="mm-flow-arrow">→</div>
              <div className="mm-flow-pill"><strong>Projects</strong><span>Work</span></div>
              <div className="mm-flow-arrow">→</div>
              <div className="mm-flow-pill"><strong>Assignments</strong><span>Execution</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Use these to move through the initial setup sequence quickly.</CardDescription>
          </CardHeader>
          <CardContent className="mm-link-grid">
            {quickLinks.map((link) => (
              <a key={link.href} href={link.href} className="mm-link-card">
                <strong>{link.label}</strong>
                <span>Open</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create your first plan</CardTitle>
          <CardDescription>One simple path gets a brand-new workspace into a usable state quickly.</CardDescription>
        </CardHeader>
        <CardContent className="mm-step-list">
          {steps.map((step, index) => (
            <div key={step} className="mm-step-item">
              <div className="mm-step-number">{index + 1}</div>
              <div>
                <strong>{step}</strong>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
