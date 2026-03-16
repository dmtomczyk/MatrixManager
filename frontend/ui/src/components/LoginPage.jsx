import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function LoginPage({ error = '', next = '/', logoHref = '', githubUrl = '' }) {
  return (
    <main className="mm-login-shell">
      <section className="mm-login-layout">
        <Card className="mm-login-intro-card">
          <CardHeader>
            <CardTitle>Staff planning without the spreadsheet sprawl</CardTitle>
            <CardDescription>
              Matrix Manager keeps organizations, people, projects, and assignments in one operating view.
            </CardDescription>
          </CardHeader>
          <CardContent className="mm-login-intro-list">
            <div className="mm-info-row">
              <strong>Organizations</strong>
              <span>Keep the reporting structure and home teams clear.</span>
            </div>
            <div className="mm-info-row">
              <strong>Projects</strong>
              <span>Track work demand and staffing pressure over time.</span>
            </div>
            <div className="mm-info-row">
              <strong>Assignments</strong>
              <span>Connect people to work with dates and allocation.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mm-login-card">
          <CardHeader className="mm-login-header">
            {logoHref ? <img src={logoHref} alt="Matrix Management" className="mm-login-logo" /> : null}
            <CardTitle className="mm-login-title">Matrix Manager</CardTitle>
            <CardDescription>Sign in to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <div className="mm-alert mm-alert-error">{error}</div> : null}
            <form method="post" action="/login" className="mm-form-grid">
              <input type="hidden" name="next" value={next} />
              <Label>
                <span>Username</span>
                <Input name="username" autoComplete="username" required />
              </Label>
              <Label>
                <span>Password</span>
                <Input name="password" type="password" autoComplete="current-password" required />
              </Label>
              <Button type="submit">Sign in</Button>
            </form>
            {githubUrl ? (
              <a href={githubUrl} className="mm-login-github" target="_blank" rel="noreferrer">
                <span>GitHub</span>
              </a>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
