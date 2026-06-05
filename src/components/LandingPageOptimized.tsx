import { useEffect, useState } from 'react';
import { useUser } from '@clerk/react';

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

const NonAuthenticatedHome = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-brand/30 overflow-x-hidden font-sans">
      <div className="container mx-auto px-4 py-24 md:py-32 lg:py-40">
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] font-black tracking-tight mb-14 leading-[1.1]">
          Izy<span className="text-brand">Flow</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed mb-12 text-center max-w-4xl mx-auto">
          Streamline your business with our comprehensive management platform
        </p>
        
        <div className="text-center">
          <button className="bg-brand hover:bg-brand/90 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

const AuthenticatedHome = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <LoadingFallback />
    </div>
  );
};

export default function LandingPageOptimized() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <LoadingFallback />;
  }

  return isSignedIn ? <AuthenticatedHome /> : <NonAuthenticatedHome />;
}