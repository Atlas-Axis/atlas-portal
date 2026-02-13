'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react';
import { Lock } from 'lucide-react';
import { authenticateAction } from './_actions/auth-actions';

/**
 * Password input component for Sync Status dashboard
 *
 * Displays a centered password form. On successful authentication,
 * sets a cookie and reloads the page to show the protected content.
 */
export function PasswordInput() {
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authenticateAction(password);

      if (result.success) {
        // Reload page to show protected content
        window.location.reload();
      } else {
        setError(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Authentication error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-md p-3">
        <CardHeader className="flex-col items-center gap-2 pb-4">
          <div className="bg-primary-100 rounded-full p-3">
            <Lock size={32} className="text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Authentication Required</h1>
          <p className="text-center text-sm text-slate-600">
            Please enter the password to access the Sync Status dashboard
          </p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              label="Password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isInvalid={error.length > 0}
              errorMessage={error || undefined}
              autoFocus
              size="lg"
            />
            <Button type="submit" color="primary" size="lg" className="w-full" isLoading={isLoading}>
              Unlock
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
