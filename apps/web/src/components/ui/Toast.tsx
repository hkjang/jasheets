import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#323232',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '4px',
      zIndex: 1000,
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      {message}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
