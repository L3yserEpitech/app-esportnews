'use client';

import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    const baseStyles = `
      rounded-lg transition-all duration-200
    `;

    const variants = {
      default: `
        bg-gray-800 border border-gray-700
      `,
      elevated: `
        bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl
      `,
      outlined: `
        bg-transparent border-2 border-pink-500
      `
    };

    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6'
    };

    const combinedClassName = `
      ${baseStyles}
      ${variants[variant]}
      ${paddings[padding]}
      ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
      <div
        ref={ref}
        className={combinedClassName}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
