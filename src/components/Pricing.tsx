import { Check, Zap, Shield, Globe, Users, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface PricingProps {
  onSelect?: (planName: string, price: string) => void;
}

export function Pricing({ onSelect }: PricingProps) {
  const tiers = [
    {
      name: "Starter",
      price: "GH₵ 0",
      description: "Perfect for freelancers and solo entrepreneurs starting out.",
      features: [
        "Up to 10 Invoices / month",
        "1 Workspace",
        "Basic Expense Tracking",
        "GHS Currency Only",
        "Standard Support"
      ],
      cta: "Start for Free",
      highlight: false,
      icon: <Zap className="h-5 w-5 text-indigo-500" />
    },
    {
      name: "Pro",
      price: "GH₵ 79",
      period: "/month",
      description: "For growing businesses that need advanced financial tools.",
      features: [
        "Up to 50 Invoices / month",
        "2 Workspaces",
        "Clients & CRM Database",
        "Multi-currency (USD, GBP, EUR)",
        "Advanced Analytics",
        "Priority Email Support"
      ],
      cta: "Go Pro",
      highlight: true,
      icon: <Sparkles className="h-5 w-5 text-indigo-400" />
    },
    {
      name: "Agency",
      price: "GH₵ 450",
      period: "/month",
      description: "Complete financial operating system for teams and agencies.",
      features: [
        "Unlimited Invoices / month",
        "10 Workspaces",
        "Team Collaboration (5 seats)",
        "Clients & CRM Database",
        "Interactive Price Calculator",
        "Custom Branding",
        "Automated Overdue Reminders",
        "Dedicated Account Manager"
      ],
      cta: "Go Agency",
      highlight: false,
      icon: <Shield className="h-5 w-5 text-indigo-500" />
    }
  ];

  return (
    <section id="pricing" className="py-24 bg-[#050505] text-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-6"
          >
            <Globe className="h-3 w-3" />
            Pricing Strategy
          </motion.div>
          <h2 className="text-5xl md:text-6xl font-black tracking-tight mb-6">Built for the West African market.</h2>
          <p className="text-xl text-white/40 leading-relaxed">
            Competitive pricing that scales with your business. From local freelancers to global agencies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "relative p-10 rounded-[3rem] border transition-all duration-500 group",
                tier.highlight 
                  ? "bg-indigo-600 border-indigo-500 shadow-2xl shadow-indigo-600/20 scale-105 z-10" 
                  : "bg-white/5 border-white/5 hover:bg-white/10"
              )}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest shadow-xl">
                  Most Popular
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-8">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center",
                  tier.highlight ? "bg-white/20 text-white" : "bg-indigo-500/10 text-indigo-500"
                )}>
                  {tier.icon}
                </div>
                <h3 className="text-2xl font-black">{tier.name}</h3>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black tracking-tighter">{tier.price}</span>
                  {tier.period && <span className={cn("text-lg font-medium", tier.highlight ? "text-indigo-200" : "text-white/40")}>{tier.period}</span>}
                </div>
                <p className={cn("text-sm mt-4 leading-relaxed", tier.highlight ? "text-indigo-100" : "text-white/40")}>
                  {tier.description}
                </p>
              </div>

              <div className="space-y-4 mb-10">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className={cn("h-5 w-5 shrink-0", tier.highlight ? "text-white" : "text-indigo-500")} />
                    <span className={cn("text-sm font-medium", tier.highlight ? "text-indigo-50" : "text-white/60")}>{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                onClick={() => onSelect?.(tier.name, tier.price)}
                className={cn(
                  "w-full h-16 rounded-2xl font-black text-lg transition-all active:scale-95",
                  tier.highlight 
                    ? "bg-white text-indigo-600 hover:bg-indigo-50 shadow-xl" 
                    : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {tier.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="mt-24 p-12 rounded-[3rem] bg-indigo-600/10 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <h4 className="text-2xl font-black mb-2">Need a custom plan?</h4>
            <p className="text-white/40">We offer tailored solutions for large enterprises and government institutions in West Africa.</p>
          </div>
          <Button 
            variant="outline" 
            className="h-14 px-8 rounded-2xl border-indigo-500/50 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all font-black"
            onClick={() => window.open('https://wa.me/233507750048', '_blank')}
          >
            Talk to an Expert
          </Button>
        </div>
      </div>
    </section>
  );
}
