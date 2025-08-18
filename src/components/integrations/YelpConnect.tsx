'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type YelpBusiness = {
  id: string;
  name: string;
  location: {
    display_address: string[];
  };
  rating: number;
  review_count: number;
  url: string;
};

export function YelpConnect() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [businesses, setBusinesses] = useState<YelpBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !location.trim()) {
      setError('Please enter both business name and location');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        location: location.trim(),
        limit: '5',
      });

      const response = await fetch(`/api/yelp/search?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search Yelp');
      }

      const data = await response.json();
      setBusinesses(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search Yelp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedBusinessId) {
      setError('Please select a business to connect');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // In a real app, you would save this to your database
      // and set up webhooks or background jobs to sync reviews
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // For demo purposes, we'll just set connected to true
      setIsConnected(true);
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect Yelp business');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-800">Yelp Connected</AlertTitle>
        <AlertDescription className="text-green-700">
          Your Yelp business has been successfully connected. Reviews will be synced automatically.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Yelp Business</CardTitle>
        <CardDescription>
          Connect your Yelp business to monitor and respond to reviews in one place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              placeholder="Enter your business name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="City or ZIP code"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {businesses.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="font-medium">Select your business</h3>
            <RadioGroup
              value={selectedBusinessId}
              onValueChange={setSelectedBusinessId}
              className="space-y-2"
            >
              {businesses.map((business) => (
                <div key={business.id} className="flex items-center space-x-3">
                  <RadioGroupItem value={business.id} id={business.id} />
                  <Label htmlFor={business.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{business.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {business.location.display_address?.join(', ')}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <span className="text-yellow-500 mr-1">★</span>
                      {business.rating} ({business.review_count} reviews)
                      <a
                        href={business.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:underline flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View on Yelp
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          onClick={handleConnect}
          disabled={!selectedBusinessId || isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect Business'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
