import Image from "next/image";

type LogoMarkProps = {
  variant?: "full" | "icon";
  size?: "header" | "footer" | "compact";
  className?: string;
};

const SIZE_MAP = {
  full: {
    header: { width: 118, height: 65 },
    footer: { width: 164, height: 90 },
    compact: { width: 136, height: 75 },
  },
  icon: {
    header: { width: 34, height: 30 },
    footer: { width: 32, height: 28 },
    compact: { width: 28, height: 24 },
  },
} as const;

export function LogoMark({
  variant = "full",
  size = "header",
  className,
}: LogoMarkProps) {
  const dimensions = SIZE_MAP[variant][size];
  const src = variant === "icon" ? "/icon.png" : "/logo.png";

  return (
    <Image
      src={src}
      alt="The IELTS Exam"
      width={dimensions.width}
      height={dimensions.height}
      className={className ? `brand-logo ${className}` : "brand-logo"}
      priority={size === "header"}
    />
  );
}
