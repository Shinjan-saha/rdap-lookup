"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import HCaptcha from 'react-hcaptcha';

export default function HomePage() {
  const [type, setType] = useState('');
  const [objectValue, setObjectValue] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!captchaToken) {
      setError('Please complete the CAPTCHA challenge.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, object: objectValue, captchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'CAPTCHA validation failed. Please try again.');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCaptchaVerification(token) {
    console.log('CAPTCHA Verified:', token); // Debugging purpose
    setCaptchaToken(token);
  }

  return (
    <main className="container mx-auto p-4 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>RDAP Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="type">Object Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue placeholder="Select an RDAP type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="ip">IP</SelectItem>
                  <SelectItem value="asn">ASN</SelectItem>
                  <SelectItem value="entity">Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="object">Object Value</Label>
              <Input
                id="object"
                value={objectValue}
                onChange={(e) => setObjectValue(e.target.value)}
                placeholder="Enter RDAP object value"
              />
            </div>

            <div>
              <Label>CAPTCHA Verification</Label>
              <HCaptcha
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
                onVerify={handleCaptchaVerification}
                onExpire={() => setCaptchaToken(null)}
              />
              {captchaToken ? (
                <p className="text-green-500 text-sm mt-2">CAPTCHA verified!</p>
              ) : (
                <p className="text-red-500 text-sm mt-2">CAPTCHA not verified.</p>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button
              type="submit"
              disabled={isLoading || !type || !objectValue}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Lookup'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>RDAP Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-gray-100 border rounded-md text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
