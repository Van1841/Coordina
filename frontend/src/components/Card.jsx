import React from 'react';

export default function Card({ children, className = '', hover = true }) {
  return (
    <div
      className={`glass rounded-xl2 p-5 ${hover ? 'transition-all duration-300 hover:border-white/10 hover:shadow-glass' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
