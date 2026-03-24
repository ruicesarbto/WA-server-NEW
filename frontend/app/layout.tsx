import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

export const metadata: Metadata = {
    title: 'ScoreChat',
    description: 'WhatsApp CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
            <body>
                <AuthProvider>
                    <AuthGuard>
                        {children}
                    </AuthGuard>
                </AuthProvider>
            </body>
        </html>
    );
}
