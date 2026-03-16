import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className = '', ...props }) {
  return <section className={cn('mm-card', className)} {...props} />;
}

export function CardHeader({ className = '', ...props }) {
  return <div className={cn('mm-card-header', className)} {...props} />;
}

export function CardTitle({ className = '', ...props }) {
  return <h2 className={cn('mm-card-title', className)} {...props} />;
}

export function CardDescription({ className = '', ...props }) {
  return <p className={cn('mm-card-description', className)} {...props} />;
}

export function CardContent({ className = '', ...props }) {
  return <div className={cn('mm-card-content', className)} {...props} />;
}
