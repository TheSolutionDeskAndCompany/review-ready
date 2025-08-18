'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Facebook, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type FacebookPage = {
  id: string;
  name: string;
  category: string;
  access_token: string;
  perms: string[];
};

export function FacebookConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<FacebookPage | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [pages, setPages] = useState<FacebookPage[]>([]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // In a real app, this would open Facebook OAuth flow
      // For now, we'll simulate a successful connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate fetching pages
      setIsLoadingPages(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock pages data
      const mockPages: FacebookPage[] = [
        {
          id: '1234567890',
          name: 'My Business Page',
          category: 'LOCAL_BUSINESS',
          access_token: 'mock_access_token',
          perms: ['ADMINISTER', 'EDIT_PROFILE', 'CREATE_CONTENT', 'MODERATE_CONTENT']
        }
      ];
      
      setPages(mockPages);
      if (mockPages.length > 0) {
        setPage(mockPages[0]);
      }
    } catch (err) {
      console.error('Facebook connection error:', err);
      setError('Failed to connect to Facebook. Please try again.');
    } finally {
      setIsConnecting(false);
      setIsLoadingPages(false);
    }
  };

  const handlePageSelect = (pageId: string) => {
    const selectedPage = pages.find(p => p.id === pageId);
    if (selectedPage) {
      setPage(selectedPage);
    }
  };

  const handleSave = async () => {
    if (!page) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      // In a real app, this would save the page access token to your backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to save Facebook page:', err);
      setError('Failed to save Facebook page. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-800">Facebook Connected</AlertTitle>
        <AlertDescription className="text-green-700">
          Your Facebook Page has been successfully connected. You can now view and manage reviews.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Facebook Page</CardTitle>
        <CardDescription>
          Connect your Facebook Business Page to manage reviews in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pages.length ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Facebook className="h-5 w-5 text-blue-600" />
              <span>Connect with Facebook to manage your Page's reviews</span>
            </div>
            <p className="text-sm text-muted-foreground">
              You'll be redirected to Facebook to authorize access to your Pages.
              We'll only request the permissions needed to manage your reviews.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select a Page</Label>
              <div className="space-y-2">
                {pages.map((p) => (
                  <div 
                    key={p.id} 
                    className={`p-4 border rounded-md cursor-pointer transition-colors ${
                      page?.id === p.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handlePageSelect(p.id)}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{p.category}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Permissions requested:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>View your public profile</li>
                <li>Access your Page's reviews</li>
                <li>Respond to reviews on your behalf</li>
              </ul>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {!pages.length ? (
          <Button 
            onClick={handleConnect}
            disabled={isConnecting || isLoadingPages}
            className="bg-[#1877F2] hover:bg-[#166FE5]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Facebook className="mr-2 h-4 w-4" />
                Continue with Facebook
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={handleSave}
            disabled={!page || isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Connect Page'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
