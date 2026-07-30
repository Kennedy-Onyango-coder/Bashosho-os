import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function BashoshoLogo({ size = 100, showText = true, className = "" }: LogoProps) {
  const [imageError, setImageError] = React.useState(false);

  // If the physical asset is present and loads successfully, we can render it.
  // Otherwise, we fall back to this gorgeous high-fidelity vector replica.
  if (!imageError) {
    return (
      <img
        src="/assets/logo.png"
        alt="Bashosho Talents CBO Logo"
        width={size}
        height={size}
        className={`${className} object-contain`}
        onError={() => setImageError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  // High-fidelity vector SVG representation of the circular badge
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${className}`}
      style={{ width: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="max-w-full"
      >
        {/* Outer Red Ring */}
        <circle cx="200" cy="200" r="190" stroke="#E31E24" strokeWidth="4" />
        
        {/* Inner Green Ring */}
        <circle cx="200" cy="200" r="182" stroke="#00A651" strokeWidth="3" />

        {/* Center Figure: Red Center Person (Arms Raised, Sphere Head) */}
        {/* Sphere Head */}
        <circle cx="200" cy="115" r="18" fill="#E31E24" />
        {/* Raised Arms and Body */}
        <path
          d="M200 135 C175 160 155 110 135 110 C155 130 170 190 200 245 C230 190 245 130 265 110 C245 110 225 160 200 135 Z"
          fill="#E31E24"
        />

        {/* Left Green Figure (Arms Raised, flanking center) */}
        <circle cx="145" cy="130" r="12" fill="#00A651" />
        <path
          d="M145 145 C125 155 110 120 95 125 C110 135 125 175 145 195 C155 165 150 150 145 145 Z"
          fill="#00A651"
        />

        {/* Right Green Figure (Arms Raised, flanking center) */}
        <circle cx="255" cy="130" r="12" fill="#00A651" />
        <path
          d="M255 145 C275 155 290 120 305 125 C290 135 275 175 255 195 C245 165 250 150 255 145 Z"
          fill="#00A651"
        />

        {/* Brand Text Wrapper */}
        {/* "BASHOSHO" - Stencil / Serif style */}
        <text
          x="200"
          y="275"
          textAnchor="middle"
          fill="#E31E24"
          fontSize="46"
          fontWeight="900"
          fontFamily="Impact, sans-serif"
          letterSpacing="4"
        >
          BASHOSHO
        </text>

        {/* "Talents CBO" - with left and right horizontal lines */}
        <line x1="60" y1="298" x2="110" y2="298" stroke="#E31E24" strokeWidth="3" />
        <text
          x="200"
          y="312"
          textAnchor="middle"
          fill="#00A651"
          fontSize="28"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
        >
          Talents CBO
        </text>
        <line x1="290" y1="298" x2="340" y2="298" stroke="#E31E24" strokeWidth="3" />

        {/* Slogan line: "Connecting Youths Through Talents" */}
        <line x1="80" y1="330" x2="320" y2="330" stroke="#E31E24" strokeWidth="1" />
        <text
          x="200"
          y="355"
          textAnchor="middle"
          fill="#E31E24"
          fontSize="18"
          fontStyle="italic"
          fontWeight="600"
          fontFamily="Georgia, serif"
        >
          Connecting Youths Through Talents
        </text>
      </svg>
      {showText && size > 120 && (
        <span className="mt-2 text-xs font-semibold text-neutral-600 font-mono tracking-wider">
          EST. KIAMBIU, NAIROBI
        </span>
      )}
    </div>
  );
}
