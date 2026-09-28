import Image from "next/image";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/roomates-icon.png"
      alt="RooMates"
      width={size}
      height={size}
      className="rounded-md"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
