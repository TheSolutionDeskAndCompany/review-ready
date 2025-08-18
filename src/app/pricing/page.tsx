import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { createCheckoutSession } from './actions';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: 29,
      description: 'Perfect for small businesses',
      features: [
        '1 Google location',
        '200 replies per month',
        '1 user',
        'Email support',
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || '',
    },
    {
      name: 'Pro',
      price: 79,
      description: 'For growing teams',
      features: [
        '5 locations',
        '2 users included',
        'Unlimited replies',
        'Priority support',
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || '',
      featured: true,
    },
    {
      name: 'Agency',
      price: 199,
      description: 'For agencies & multi-location businesses',
      features: [
        '25 locations',
        '10 users included',
        'Shared inbox',
        'Dedicated account manager',
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY || '',
    },
  ];

  return (
    <div className="container max-w-6xl py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Simple, transparent pricing</h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Start with a 7-day free trial. No credit card required.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.featured ? 'border-2 border-primary shadow-lg' : ''}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <form action={createCheckoutSession} className="w-full">
                <input type="hidden" name="priceId" value={plan.priceId} />
                <Button className="w-full" size="lg">
                  Get Started
                </Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
