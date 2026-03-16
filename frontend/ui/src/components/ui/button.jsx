import React from 'react';
import { cn } from '../../lib/utils';

export function Button({ className = '', variant = 'default', ...props }) {
  return <button className={cn('mm-btn', `mm-btn-${variant}`, className)} {...props} />;
}
