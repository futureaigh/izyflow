import { Workspace, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { CreditCard, Zap, CheckCircle2, ShieldCheck, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { initializePayment } from '../lib/paystack';
import { toast } from 'sonner';

interface SubscriptionProps {
  workspace: Workspace | null;
  user: UserProfile | null;
}

export function Subscription({ workspace, user }: SubscriptionProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePlanSelect = async (planName: string, priceStr: string) => {
    if (planName === 'Free') {
      toast.info("You're already on the Free plan.");
      return;
    }

    if (!user?.email) {
      toast.error("User email not found. Please log in again.");
      return;
    }

    // Extract numeric price from GH₵ 79 etc.
    const amount = parseInt(priceStr.replace(/[^0-9]/g, ''));
    
    setLoading(planName);
    try {
      const result = await initializePayment(user.email, amount, planName);
      if (result.status && result.data?.authorization_url) {
        window.location.href = result.data.authorization_url;
      } else {
        throw new Error(result.message || "Failed to initialize payment");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred during payment initialization");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: 'GH₵ 0',
      description: 'Perfect for freelancers and solo entrepreneurs starting out.',
      features: [
        'Up to 5 Invoices / month',
        '1 Workspace',
        'Basic Expense Tracking',
        'GHS Currency Only',
        'Standard Support'
      ],
      current: user?.subscription?.plan === 'Free'
    },
    {
      name: 'Pro',
      price: 'GH₵ 79',
      description: 'For growing businesses that need advanced financial tools.',
      features: [
        'Unlimited Invoices',
        '3 Workspaces',
        'Full Pricing Engine',
        'Multi-currency (USD, GBP, EUR)',
        'Advanced Analytics',
        'Priority Email Support'
      ],
      current: user?.subscription?.plan === 'Pro',
      popular: true
    },
    {
      name: 'Agency',
      price: 'GH₵ 450',
      description: 'Complete financial operating system for teams and agencies.',
      features: [
        'Unlimited Everything',
        'Unlimited Workspaces',
        'Team Collaboration (5 seats)',
        'Custom Branding',
        'Automated Overdue Reminders',
        'Dedicated Account Manager'
      ],
      current: user?.subscription?.plan === 'Agency'
    }
  ];

  const currentPlan = plans.find(p => p.name === (user?.subscription?.plan || 'Free'));

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Subscription</h1>
        <p className="text-muted-foreground font-medium">Manage your plan and billing details.</p>
      </div>

      <div className="space-y-8">
        {/* Current Plan Overview */}
        <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap className="h-32 w-32 text-indigo-500" />
          </div>
          <CardHeader>
            <CardTitle className="text-2xl font-black flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-indigo-500" />
              Current Plan: {user?.subscription?.plan || 'Free'}
            </CardTitle>
            <CardDescription className="text-base">
              Your account is currently on the {user?.subscription?.plan || 'Free'} plan ({currentPlan?.price}/month).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-6 rounded-2xl bg-muted/50 border border-border space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 rounded-full px-3 py-1 font-bold">
                    {user?.subscription?.status || 'Active'}
                  </Badge>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-muted/50 border border-border space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Next Billing Date</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-lg font-bold text-foreground">
                    {user?.subscription?.expiryDate ? format(new Date(user.subscription.expiryDate), 'MMMM d, yyyy') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={cn(
                "border-border bg-card/50 shadow-xl backdrop-blur-xl relative flex flex-col !overflow-visible",
                plan.popular && "border-indigo-500/50 ring-2 ring-indigo-500/10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white border-none rounded-full px-4 py-1 font-black text-[10px] uppercase tracking-widest">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl font-black">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-muted-foreground text-sm">/mo</span>}
                </div>
                <CardDescription className="text-xs font-medium min-h-[32px]">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <Button 
                  variant={plan.current ? 'outline' : 'default'}
                  onClick={() => handlePlanSelect(plan.name, plan.price)}
                  disabled={plan.current || !!loading}
                  className={cn(
                    "w-full rounded-xl font-bold h-11",
                    plan.current ? "border-border text-muted-foreground pointer-events-none" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  )}
                >
                  {loading === plan.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    plan.current ? 'Current Plan' : 'Choose Plan'
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
