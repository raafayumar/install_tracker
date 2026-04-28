"use client";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  active?: boolean;
  muted?: boolean;
}

export function Card({ children, className = "", hover = false, active = false, muted = false }: CardProps) {
  const baseClasses = "rounded-[12px] border shadow-[var(--shadow-sm)]";
  const bgClass = muted
    ? "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)]"
    : active
    ? "bg-card-hi border-border-active glow-ring"
    : "bg-card border-border";
  const hoverClass = hover ? "hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)] transition-all duration-250" : "";

  return (
    <div className={`${baseClasses} ${bgClass} ${hoverClass} p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-bold text-text-primary mb-1 ${className}`}>{children}</h3>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-secondary">{children}</p>;
}
