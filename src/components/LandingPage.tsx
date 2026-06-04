import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  Wallet, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  CheckCircle2,
  BarChart3,
  Receipt,
  LayoutDashboard,
  PieChart,
  Target,
  Layers,
  FileText,
  Calculator,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  Bot,
  Sparkles,
  HelpCircle,
  ArrowUpRight,
  PlusCircle,
  Banknote,
  MinusCircle,
  Eye,
  MousePointer2,
  Lock,
  ArrowRightLeft,
  ShoppingCart,
  BookOpen,
  Split
} from 'lucide-react';
import { CMSConfig } from '../types';
import { LOGO_URL } from '../constants';

import { Pricing } from './Pricing';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin?: () => void;
  config: CMSConfig | null;
}

export function LandingPage({ onGetStarted, onLogin, config }: LandingPageProps) {
  const heroHeading = config?.heroHeading || "Track Your Money. Know Your Business";
  const heroSubtext = config?.heroSubtext || "IzyFlow automates your invoicing, tracks every expense, and gives you absolute clarity on your business health. No spreadsheets, no guesswork.";
  const heroBadgeText = config?.heroBadgeText || "Master your money. Build your legacy.";
  
  const intelligenceHeading = config?.intelligenceHeading || "Absolute visibility, zero guesswork.";
  const intelligenceSubtext = config?.intelligenceSubtext || "Stop juggling spreadsheets. IzyFlow gives you a real-time command center where every revenue stream, expense, and profit margin is visible at a glance.";
  
  const automationHeading = config?.automationHeading || "Your finances on autopilot.";
  const automationSubtext = config?.automationSubtext || "Let IzyFlow handle the heavy lifting. From intelligent income splitting to AI-powered insights, we build discipline into your business.";
  
  const growthHeading = config?.growthHeading || "Invoicing that gets you paid.";
  const growthSubtext = config?.growthSubtext || "Create professional, high-converting invoices in seconds. Track payments automatically and never chase a client again.";
  
  const dataFreedomHeading = config?.dataFreedomHeading || "Your data, always yours.";
  const dataFreedomSubtext = config?.dataFreedomSubtext || "Bring your history with you. Import from CSV, PDF, or even screenshots. Export anytime to share with your team or accountant. No lock-in, ever.";
  
  const simplicityHeading = config?.simplicityHeading || "Zero learning curve.";
  const simplicitySubtext = config?.simplicitySubtext || "No accounting degree required. IzyFlow is designed for builders, not bookkeepers. Get set up in minutes and start seeing your numbers clearly.";
  
  const ctaHeading = config?.ctaHeading || "Take control of your money.";
  const ctaSubtext = config?.ctaSubtext || "Track, organize, and understand your finances — automatically. Join the next generation of builders today.";
  
  const footerSubtext = config?.footerSubtext || "The all-in-one financial operating system for modern businesses. Built for clarity, not complexity.";

  const services = config?.services || [
    { title: "Real-time Sync", description: "All accounts in one place.", icon: <RefreshCw className="h-5 w-5" /> },
    { title: "Business Profit Tracking", description: "Know your actual earnings.", icon: <Zap className="h-5 w-5" /> },
    { title: "Cash Flow", description: "See available funds now.", icon: <Wallet className="h-5 w-5" /> },
    { title: "Smart Alerts", description: "Stay ahead of trends.", icon: <TrendingUp className="h-5 w-5" /> }
  ];
  const faqs = config?.faqs || [
    { question: "Does IzyFlow store or move money?", answer: "No. IzyFlow helps you track and manage your finances. Your money stays in your bank or mobile wallet. We provide the visibility, you keep the control." },
    { question: "Is my data secure?", answer: "Yes. We use industry-standard encryption and security protocols to ensure your financial data is protected at all times." },
    { question: "Can I use it for multiple businesses?", answer: "Absolutely. Our Workspaces feature allows you to manage multiple businesses, projects, or personal finances separately within one account." }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-brand/30 overflow-x-hidden font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <img 
              src={config?.logoUrl || LOGO_URL} 
              alt="Logo" 
              className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300" 
              referrerPolicy="no-referrer"
            />
            {!config?.hideBrandName && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl sm:text-2xl tracking-tighter hidden min-[400px]:block">IzyFlow</span>
                <span className="bg-brand/20 border border-brand/30 text-brand text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:block">Beta</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center gap-10 text-[13px] tracking-wider font-semibold text-white/50">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" onClick={onLogin ?? onGetStarted} className="text-white/70 hover:text-white hover:bg-white/5 font-bold text-xs sm:text-sm tracking-wide px-2 sm:px-4">
                Log In
              </Button>
              <Button onClick={onGetStarted} className="rounded-full px-4 sm:px-8 h-10 sm:h-11 bg-white text-black hover:bg-white/90 font-bold text-xs sm:text-sm tracking-wide transition-all hover:scale-105 active:scale-95">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 lg:pt-56 lg:pb-48 overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full" />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-600/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-10 backdrop-blur-md"
            >
              <span className="flex h-2 w-2 rounded-full bg-brand animate-ping" />
              <span className="text-[11px] font-black tracking-widest text-white uppercase drop-shadow-sm">🚀 Now in Public Beta • {heroBadgeText}</span>
            </motion.div>
            
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] font-black tracking-tight mb-10 leading-[0.95]">
              {heroHeading}
            </h1>
            
            <p className="text-white/50 text-xl md:text-2xl max-w-3xl mx-auto mb-14 leading-relaxed font-medium">
              {heroSubtext}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
              <Button onClick={onGetStarted} size="lg" className="h-16 w-full sm:w-auto px-12 rounded-full text-lg font-black tracking-wide bg-brand hover:bg-brand/90 text-white shadow-2xl shadow-brand/20 transition-all hover:scale-105 active:scale-95">
                Start your journey
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
              <Button variant="outline" size="lg" onClick={onGetStarted} className="h-16 w-full sm:w-auto px-12 rounded-full text-lg font-bold tracking-wide border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md transition-all">
                Explore features
              </Button>
            </div>

            {/* Early Access Badge with Atmospheric Visuals */}
            <div className="relative py-20 w-full flex flex-col items-center justify-center overflow-hidden">
              {/* Subtle Grid Background */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" 
                style={{ 
                  backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                  backgroundSize: '40px 40px' 
                }} 
              />
              
              {/* Glowing Orb */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

              <div className="relative z-10 flex flex-col items-center gap-6">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand/10 border border-brand/20 backdrop-blur-xl shadow-2xl shadow-brand/10"
                >
                  <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-[11px] font-black tracking-[0.3em] text-brand uppercase">Early Access Program</span>
                </motion.div>
                
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-lg md:text-xl font-medium tracking-tight text-white/60 text-center max-w-lg"
                >
                  Join the <span className="text-white font-bold">first 100</span> founders building the future of financial clarity.
                </motion.p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intelligence Section - Consolidating Dashboard & Core Values */}
      <section id="features" className="py-40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-24 items-center mb-32">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 mb-8">
                <Sparkles className="h-3 w-3 text-brand" />
                <span className="text-[10px] font-black tracking-widest text-brand uppercase">Intelligence</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] mb-10">{intelligenceHeading}</h2>
              <p className="text-white/50 text-xl mb-12 leading-relaxed">
                {intelligenceSubtext}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {services.map((item, i) => (
                  <div key={i} className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center mb-4 text-brand">
                      {typeof item.icon === 'string' ? <Zap className="h-5 w-5" /> : item.icon}
                    </div>
                    <h4 className="text-sm font-black mb-1">{item.title}</h4>
                    <p className="text-xs text-white/40">{item.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <div className="relative group w-full">
              <div className="absolute -inset-4 bg-gradient-to-br from-brand to-purple-600 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              <div className="relative aspect-auto lg:aspect-[4/5] min-h-[400px] rounded-[2.5rem] border border-white/10 bg-black overflow-hidden shadow-2xl p-6 sm:p-8 flex flex-col gap-6">
                {config?.heroImageUrl ? (
                  <img src={config.heroImageUrl} alt="Hero Visual" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-brand/20 flex items-center justify-center">
                          <LayoutDashboard className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                          <p className="text-xs font-black">Command Center</p>
                          <p className="text-[10px] text-white/40">Live financial feed</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Healthy</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                        <p className="text-[10px] font-black text-white/40 mb-2 uppercase tracking-wider">Revenue</p>
                        <p className="text-2xl font-black">$42,850</p>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-500">
                          <TrendingUp className="h-3 w-3" />
                          <span>+12.5%</span>
                        </div>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                        <p className="text-[10px] font-black text-white/40 mb-2 uppercase tracking-wider">Expenses</p>
                        <p className="text-2xl font-black">$12,400</p>
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-rose-500">
                          <TrendingUp className="h-3 w-3 rotate-180" />
                          <span>-4.2%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 rounded-3xl bg-white/5 border border-white/5 p-6 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black">Monthly Growth</p>
                        <div className="flex gap-1">
                          {[1,2,3,4].map(i => <div key={i} className="h-1 w-4 rounded-full bg-brand/20" />)}
                        </div>
                      </div>
                      <div className="flex items-end gap-2 h-32">
                        {[40, 60, 45, 90, 65, 80, 100].map((h, i) => (
                          <motion.div 
                            key={i}
                            initial={{ height: 0 }}
                            whileInView={{ height: `${h}%` }}
                            className="flex-1 bg-gradient-to-t from-brand to-purple-600 rounded-t-lg"
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Automation Section - Highlighting Izy & Auto-Allocation */}
      <section className="py-40 bg-zinc-900/30 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/5 blur-[150px] rounded-full" />
        </div>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-32">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
              <Bot className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] font-black tracking-widest text-purple-500 uppercase">Automation</span>
            </div>
            <h2 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.85] mb-10">{automationHeading}</h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">{automationSubtext}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-16 rounded-[4rem] bg-brand text-white shadow-2xl shadow-brand/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full group-hover:scale-110 transition-transform duration-1000" />
              <RefreshCw className="h-16 w-16 mb-12 text-brand-foreground/80" />
              <h3 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] mb-10">Auto-Allocation</h3>
              <p className="text-brand-foreground/90 text-xl mb-12 leading-relaxed">Set your rules once. Automatically split incoming payments into tax, savings, and operating accounts. Stay consistent without lifting a finger.</p>
              <div className="flex items-center gap-4">
                <div className="px-6 py-3 rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-xs font-black">Tax: 25%</div>
                <div className="px-6 py-3 rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-xs font-black">Savings: 15%</div>
              </div>
            </div>
            <div className="p-16 rounded-[4rem] bg-zinc-900/50 border border-white/5 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand/10 blur-[120px] rounded-full group-hover:bg-brand/20 transition-colors duration-1000" />
              <Bot className="h-16 w-16 text-brand mb-12 group-hover:scale-110 transition-transform" />
              <h3 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] mb-10">Meet Izy</h3>
              <p className="text-white/40 text-xl mb-12 leading-relaxed">Your personal AI financial assistant. Ask about your burn rate, forecast next month's revenue, or get instant help with invoicing. Izy knows your numbers.</p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 w-fit">
                <Sparkles className="h-4 w-4 text-brand" />
                <span className="text-[10px] font-black tracking-wide text-brand uppercase">AI-Powered Support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Growth Tools - Invoicing & Calculator */}
      <section className="py-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-16 rounded-[3.5rem] bg-white text-black flex flex-col justify-between min-h-[600px]">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 mb-8">
                  <Receipt className="h-3 w-3 text-brand" />
                  <span className="text-[10px] font-black tracking-widest text-brand uppercase">Growth</span>
                </div>
                <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] mb-10">{growthHeading}</h2>
                <p className="text-black/50 text-xl max-w-xl mb-12">{growthSubtext}</p>
                <div className="grid grid-cols-2 gap-4">
                  {['One-click Sending', 'Payment Tracking', 'Auto-Reminders', 'Multi-Currency'].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-bold">
                      <CheckCircle2 className="h-5 w-5 text-brand" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={onGetStarted} className="w-fit h-14 px-10 rounded-full bg-black text-white hover:bg-zinc-800 font-black tracking-wide text-sm mt-12">
                Create your first invoice
              </Button>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="flex-1 p-12 rounded-[3.5rem] bg-emerald-600 text-white flex flex-col justify-between group">
                <div>
                  <Calculator className="h-10 w-10 mb-8 text-emerald-200 group-hover:scale-110 transition-transform" />
                  <h3 className="text-3xl font-black mb-4">Pricing Calculator</h3>
                  <p className="text-emerald-100/70 text-lg leading-relaxed">Calculate Landed Costs for products or use the Safety Buffer for services. Export results as high-quality screenshots.</p>
                </div>
                <Button variant="ghost" className="w-fit p-0 text-white hover:bg-transparent hover:text-white/80 font-black flex items-center gap-2">
                  Try it now <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-12 rounded-[3.5rem] bg-zinc-900 border border-white/5 flex flex-col justify-between group">
                <div>
                  <Layers className="h-10 w-10 mb-8 text-brand group-hover:scale-110 transition-transform" />
                  <h3 className="text-3xl font-black mb-4">Workspaces</h3>
                  <p className="text-white/40 text-lg leading-relaxed">Separate personal, business, and side-projects with ease. Absolute isolation.</p>
                </div>
                <div className="flex gap-2">
                  {['Personal', 'Business', 'Side-Hustle'].map((w, i) => (
                    <div key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-black">{w}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Section - Import/Export */}
      <section className="py-40 bg-zinc-900/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
                <UploadCloud className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-black tracking-widest text-blue-500 uppercase">Data Freedom</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] mb-10">{dataFreedomHeading}</h2>
              <p className="text-white/50 text-xl mb-12 leading-relaxed">
                {dataFreedomSubtext}
              </p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2 text-sm font-bold text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  CSV/Excel
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  PDF Statements
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  JSON Export
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square rounded-[3rem] bg-white/5 border border-white/5 flex flex-col items-center justify-center p-8 text-center group hover:bg-white/10 transition-colors">
                <UploadCloud className="h-12 w-12 text-blue-500 mb-6 group-hover:scale-110 transition-transform" />
                <p className="font-black text-sm">Import</p>
                <p className="text-[10px] text-white/40 mt-2">Bring your data in</p>
              </div>
              <div className="aspect-square rounded-[3rem] bg-white/5 border border-white/5 flex flex-col items-center justify-center p-8 text-center group hover:bg-white/10 transition-colors">
                <DownloadCloud className="h-12 w-12 text-purple-500 mb-6 group-hover:scale-110 transition-transform" />
                <p className="font-black text-sm">Export</p>
                <p className="text-[10px] text-white/40 mt-2">Take your data out</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simplicity Section - Editorial Style */}
      <section className="py-60 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 blur-[150px] rounded-full" />
        </div>
        <div className="max-w-4xl mx-auto px-6">
          <Sparkles className="h-16 w-16 text-amber-500 mx-auto mb-12 animate-pulse" />
          <h2 className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.8] mb-12">{simplicityHeading}</h2>
          <p className="text-white/40 text-2xl md:text-3xl max-w-2xl mx-auto mb-20 font-medium leading-relaxed">
            {simplicitySubtext}
          </p>
          <div className="flex flex-wrap justify-center gap-12">
            {['Intuitive Design', 'One-Click Setup', 'No Jargon'].map((item, i) => (
              <div key={i} className="flex items-center gap-4 font-black text-xl tracking-widest text-white/80">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Synergy Section - The Automated Loop */}
      <section className="py-40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
              <RefreshCw className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase">The Integrated Ecosystem</span>
            </div>
            <h2 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.85] mb-10">The Synergy Loop.</h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">Stop managing tools. Start managing your business. Every feature in IzyFlow works in perfect harmony.</p>
          </div>

          <div className="relative">
            {/* Background Connection Path */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-brand/20 via-purple-500/20 to-emerald-500/20 -translate-y-1/2 hidden lg:block" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative">
              <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col gap-6 group hover:border-brand/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black mb-2">Quote</h4>
                  <p className="text-xs text-white/40 leading-relaxed">Calculate exact pricing with smart margins and safety buffers.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-brand mt-auto" />
              </div>

              <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col gap-6 group hover:border-purple-500/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black mb-2">Catalog</h4>
                  <p className="text-xs text-white/40 leading-relaxed">Save quotes to your catalog in one click. Build your inventory instantly.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-purple-500 mt-auto" />
              </div>

              <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col gap-6 group hover:border-blue-500/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black mb-2">Storefront</h4>
                  <p className="text-xs text-white/40 leading-relaxed">Share your public link. Let customers pick services and auto-generate invoices.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-500 mt-auto" />
              </div>

              <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col gap-6 group hover:border-emerald-500/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black mb-2">Payment</h4>
                  <p className="text-xs text-white/40 leading-relaxed">Accept payments and generate professional, branded receipts automatically.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-500 mt-auto" />
              </div>

              <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 flex flex-col gap-6 group hover:border-amber-500/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Split className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black mb-2">Split</h4>
                  <p className="text-xs text-white/40 leading-relaxed">Revenue is instantly distributed into your Tax and Savings accounts.</p>
                </div>
                <ArrowRightLeft className="h-4 w-4 text-amber-500 mt-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Power Features Section */}
      <section className="py-40 bg-white/5 border-y border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-32">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 mb-8">
              <Zap className="h-3 w-3 text-brand" />
              <span className="text-[10px] font-black tracking-widest text-brand uppercase">Power Features</span>
            </div>
            <h2 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.85] mb-10">Built for the modern founder.</h2>
            <p className="text-white/40 text-xl max-w-2xl mx-auto">Advanced tools that give you an unfair advantage in managing your business.</p>
          </div>

            <div className="grid md:grid-cols-3 gap-8">
            <div className="p-12 rounded-[3.5rem] bg-zinc-900/50 border border-white/5 group hover:border-brand/50 transition-colors">
              <Bot className="h-12 w-12 text-brand mb-8 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-black mb-4">Scenario Generation</h3>
              <p className="text-white/40 text-lg leading-relaxed mb-8">Just describe your transaction or invoice in plain English. Izy handles the categorization, allocation, and creation instantly.</p>
              <Badge variant="outline" className="border-brand/20 text-brand bg-brand/5">AI-Powered</Badge>
            </div>
            <div className="p-12 rounded-[3.5rem] bg-zinc-900/50 border border-white/5 group hover:border-brand/50 transition-colors">
              <BarChart3 className="h-12 w-12 text-purple-500 mb-8 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-black mb-4">Financial IQ</h3>
              <p className="text-white/40 text-lg leading-relaxed mb-8">Track Sales Targets, Quote-to-Paid conversion, and active retainers in real-time. Know exactly where your growth is coming from.</p>
              <Badge variant="outline" className="border-purple-500/20 text-purple-500 bg-purple-500/5">Advanced Analytics</Badge>
            </div>
            <div className="p-12 rounded-[3.5rem] bg-zinc-900/50 border border-white/5 group hover:border-brand/50 transition-colors">
              <Receipt className="h-12 w-12 text-emerald-500 mb-8 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-black mb-4">Flexible Billing</h3>
              <p className="text-white/40 text-lg leading-relaxed mb-8">Handle partial payments with ease. Automatically track balances and generate professional receipts for every cent received.</p>
              <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/5">Branded receipts</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <Pricing onSelect={onGetStarted} />

      {/* FAQ Section - Minimal Utility */}
      <section id="faq" className="py-40 bg-zinc-900/30 border-y border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-32">
            <HelpCircle className="h-16 w-16 text-brand mx-auto mb-10" />
            <h2 className="text-5xl font-black tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-6">
            {faqs.map((item, i) => (
              <div key={i} className="p-10 rounded-[2.5rem] bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <h3 className="text-xl font-black mb-6 tracking-tight group-hover:text-brand transition-colors">{item.question}</h3>
                <p className="text-white/40 leading-relaxed text-lg">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Dramatic Hero Style */}
      <section className="py-60 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-brand/20 via-transparent to-transparent -z-10" />
        <div className="max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative p-20 md:p-32 rounded-[5rem] bg-brand shadow-[0_0_100px_rgba(var(--brand-rgb),0.3)] overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-5xl md:text-8xl font-black mb-12 text-white leading-[0.85] tracking-tighter">{ctaHeading}</h2>
              <p className="text-brand-foreground/90 text-xl md:text-2xl mb-16 max-w-2xl mx-auto font-medium leading-relaxed">
                {ctaSubtext}
              </p>
              <Button onClick={onGetStarted} size="lg" className="h-20 px-16 bg-white text-brand hover:bg-brand-foreground/10 rounded-full text-2xl font-black tracking-wide shadow-2xl transition-all hover:scale-105 active:scale-95">
                Start your journey
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer - Minimal Editorial */}
      <footer className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-20 mb-20">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <img 
                  src={config?.logoUrl || LOGO_URL} 
                  alt="Logo" 
                  className="h-10 w-auto object-contain" 
                  referrerPolicy="no-referrer"
                />
                {!config?.hideBrandName && (
                  <span className="font-black text-3xl tracking-tighter">IzyFlow</span>
                )}
              </div>
              <p className="text-white/40 text-lg max-w-sm leading-relaxed">
                {footerSubtext}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-black tracking-widest text-white/20 mb-8">Product</h4>
              <ul className="space-y-4 text-sm font-bold tracking-wide text-white/50">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black tracking-widest text-white/20 mb-8">Company</h4>
              <ul className="space-y-4 text-sm font-bold tracking-wide text-white/50">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="https://wa.me/233507750048" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact: +233 50 775 0048</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-white/20 text-sm font-medium tracking-wider">
              {config?.copyrightText || `© ${new Date().getFullYear()} IzyFlow Inc. All rights reserved.`}
            </p>
            <div className="flex gap-6">
              {/* Social placeholders */}
              <div className="h-5 w-5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" />
              <div className="h-5 w-5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" />
              <div className="h-5 w-5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
