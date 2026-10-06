export function getPublicBaseUrl() {
  if (typeof window === 'undefined') return '';
  if (import.meta.env.VITE_PUBLIC_URL) {
    return import.meta.env.VITE_PUBLIC_URL;
  }
  // If browsing on a Vercel preview deployment (which has Vercel Authentication protection on non-team devices),
  // route QR tracking codes to the canonical public production domain so any phone can scan without authentication.
  if (window.location.origin.includes('.vercel.app')) {
    return 'https://waste-management-roan.vercel.app';
  }
  return window.location.origin;
}

