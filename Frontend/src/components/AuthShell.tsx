import Image from "next/image";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-20 py-16 bg-background">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden w-32 mb-8">
            <Image src="/roomates-icon.png" alt="RooMates" width={290} height={259} priority className="w-full h-auto" />
          </div>
          {children}
        </div>
      </div>

      <div className="hidden lg:block relative bg-background">
        <Image src="/roomates-logo.png" alt="RooMates" fill priority className="object-cover" />
      </div>
    </div>
  );
}
