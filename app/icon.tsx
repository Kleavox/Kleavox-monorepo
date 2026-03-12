//app/icon.tsx

import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#030712',
          position: 'relative',
        }}
      >
        <div 
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            width: '24px',
            height: '24px',
            backgroundColor: '#fbbf24',
          }}
        />
        
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '24px',
            height: '24px',
            backgroundColor: '#4f46e5',
            border: '2px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: '16px',
              fontWeight: 900,
              fontFamily: 'sans-serif',
              lineHeight: 1,
            }}
          >
            D
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
