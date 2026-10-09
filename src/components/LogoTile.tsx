interface LogoTileProps {
  width?: number
  className?: string
}
export function LogoTile({ width = 96, className = 'login-logo' }: LogoTileProps) {
  return (
    <div className={className}>
      <svg
        role="img"
        aria-label="Waypoint demo"
        width={width}
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="96" height="96" rx="26" fill="#0f766e" />
        <path
          d="M24 26v32a13 13 0 0 0 26 0V36a11 11 0 0 1 22 0v33"
          stroke="#ffffff"
          strokeWidth="7.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}
