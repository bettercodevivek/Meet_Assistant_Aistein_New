import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

/**
 * Meet routes use Roboto for a closer match to Google Meet typography.
 */
export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return <div className={`min-h-screen bg-[#202124] ${roboto.className}`}>{children}</div>;
}
