import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { CMSConfig, UserProfile, FAQItem, ServiceItem, UserRole, Visit } from '../types';
import { motion } from 'motion/react';
import { Settings, Image as ImageIcon, Type, Layout, Save, Loader2, ShieldCheck, ChevronRight, Globe, Palette, FileText, Plus, Trash2, HelpCircle, Briefcase, Upload, BarChart3, Users, Home, MessageCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

interface AdminPortalProps {
  user: UserProfile | null;
  initialConfig: CMSConfig | null;
  isConfigLoading: boolean;
  onConfigUpdate?: (config: CMSConfig) => void;
}

export function AdminPortal({ user, initialConfig, isConfigLoading, onConfigUpdate }: AdminPortalProps) {
  const DEFAULT_CONFIG: Partial<CMSConfig> = {
    logoUrl: "https://fe5lpvispw.ufs.sh/f/DFYBeUqk6Uo0FZB8CGgMlXyUIWpsCrZP2akSH8LzbfqD93xY",
    faviconUrl: "https://fe5lpvispw.ufs.sh/f/DFYBeUqk6Uo0FZB8CGgMlXyUIWpsCrZP2akSH8LzbfqD93xY",
    sidebarLogoUrl: "https://fe5lpvispw.ufs.sh/f/DFYBeUqk6Uo0FZB8CGgMlXyUIWpsCrZP2akSH8LzbfqD93xY",
  };

  const [config, setConfig] = useState<CMSConfig | null>(initialConfig || DEFAULT_CONFIG as CMSConfig);
  const [loading, setLoading] = useState(isConfigLoading);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'typography' | 'cms' | 'analytics' | 'team' | 'domain'>('branding');
  
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [izyErrors, setIzyErrors] = useState<any[]>([]);
  const [izyQueries, setIzyQueries] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({ ...DEFAULT_CONFIG, ...initialConfig, ...(prev || {}) }) as CMSConfig);
    } else if (!isConfigLoading) {
      setConfig(DEFAULT_CONFIG as CMSConfig);
    }
    setLoading(isConfigLoading);
  }, [initialConfig, isConfigLoading]);

  useEffect(() => {
    if (activeTab === 'analytics' || activeTab === 'team') {
      fetchAnalyticsAndUsers();
    }
  }, [activeTab]);

  const fetchAnalyticsAndUsers = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await api.adminGetStats();
      setVisits(data.visits || []);
      setAllUsers(data.users || []);
      setIzyErrors(data.errors || []);
      setIzyQueries(data.queries || []);
    } catch (error: any) {
      console.error('Admin fetch failed:', error);
      toast.error('Failed to fetch admin data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const updateUserRole = async (uid: string, role: UserRole) => {
    try {
      await api.adminUpdateUserRole(uid, role);
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
      toast.success('User role updated');
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const extractDominantColor = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#4f46e5');
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Get sample pixels from the center
        const centerX = Math.floor(img.width / 2);
        const centerY = Math.floor(img.height / 2);
        const pixelData = ctx.getImageData(centerX, centerY, 1, 1).data;
        
        // Convert to hex
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        resolve(hex);
      };
      img.onerror = () => resolve('#4f46e5');
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'sidebarLogoUrl' | 'heroImageUrl' | 'faviconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPG, or SVG.');
      return;
    }

    // Check file size (limit to 300KB for Firestore storage as base64)
    if (file.size > 300 * 1024) {
      toast.error('File too large. Max size is 300KB to ensure database compatibility.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      if (field === 'logoUrl') {
        const dominantColor = await extractDominantColor(base64String);
        setConfig(prev => prev ? { ...prev, logoUrl: base64String, brandColor: dominantColor } : null);
        toast.success('Main logo uploaded and brand color extracted!');
      } else if (field === 'sidebarLogoUrl') {
        setConfig(prev => prev ? { ...prev, sidebarLogoUrl: base64String } : null);
        toast.success('Sidebar logo uploaded successfully!');
      } else {
        setConfig(prev => prev ? { ...prev, [field]: base64String } : null);
        toast.success('Image uploaded successfully (Preview ready)');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!config) return;

    // Data Integrity Validation
    if (!config.heroHeading || config.heroHeading.length < 5) {
      toast.error('Hero heading must be at least 5 characters long.');
      return;
    }
    if (!config.heroSubtext || config.heroSubtext.length < 10) {
      toast.error('Hero subtext must be at least 10 characters long.');
      return;
    }

    setSaving(true);
    console.log('Saving CMS Config:', config);
    try {
      const updated = await api.updateCMSConfig(config);
      onConfigUpdate?.(updated);
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Save Error Details:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user || user.role !== 'Admin') {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-6">
          <ShieldCheck className="h-10 w-10 text-rose-600" />
        </div>
        <h2 className="text-3xl font-black text-foreground mb-4">Access Denied</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          This area is restricted to administrators only. If you believe this is an error, please contact support.
        </p>
        <Button 
          onClick={() => {
            window.history.pushState({}, '', '/');
            window.location.reload(); // Simplest way to reset the entire app state for now
          }} 
          className="rounded-full px-8 bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Return to Safety
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-foreground">Super-Admin Control Center</h1>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-muted-foreground font-medium">Manage global branding, typography, and landing page content.</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.location.reload();
                }}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full"
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="h-14 px-8 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 group"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />}
            Save Changes
          </Button>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-12">
          {/* Sidebar Tabs */}
          <div className="space-y-2">
            {[
              { id: 'branding', label: 'Branding', icon: ImageIcon, desc: 'Logo & Hero Images' },
              { id: 'typography', label: 'Typography', icon: Type, desc: 'Global Font Family' },
              { id: 'cms', label: 'CMS Content', icon: Layout, desc: 'Landing Page Copy' },
              { id: 'domain', label: 'Domain Setup', icon: Globe, desc: 'Custom Domain Config' },
              { id: 'analytics', label: 'Analytics', icon: BarChart3, desc: 'Site Visits & Usage' },
              { id: 'team', label: 'Team Management', icon: Users, desc: 'Manage User Roles' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full p-4 rounded-2xl text-left transition-all flex items-center justify-between group",
                  activeTab === tab.id 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-4">
                  <tab.icon className={cn("h-6 w-6", activeTab === tab.id ? "text-white" : "text-muted-foreground group-hover:text-indigo-600")} />
                  <div>
                    <p className="font-bold text-sm">{tab.label}</p>
                    <p className={cn("text-[10px] font-medium opacity-70", activeTab === tab.id ? "text-indigo-100" : "text-muted-foreground")}>
                      {tab.desc}
                    </p>
                  </div>
                </div>
                <ChevronRight className={cn("h-4 w-4 transition-transform", activeTab === tab.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
              </button>
            ))}
          </div>

          {/* Content Area */}
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-indigo-500/5"
          >
            {activeTab === 'branding' && (
              <div className="space-y-10">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Branding Assets</h3>
                    <p className="text-sm text-muted-foreground">Upload and manage your company logo and hero visuals.</p>
                  </div>
                </div>

        <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                        <Globe className="h-4 w-4 text-indigo-600" />
                        Site Identity
                      </label>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Site Name (Browser Tab)</Label>
                          <Input 
                            placeholder="My Awesome App"
                            value={config?.siteName || ''}
                            onChange={(e) => setConfig(prev => prev ? { ...prev, siteName: e.target.value } : null)}
                            className="h-14 rounded-2xl border-border bg-background focus:ring-indigo-500/20"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Favicon URL or Upload</Label>
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Input 
                                placeholder="https://example.com/favicon.ico"
                                value={config?.faviconUrl || ''}
                                onChange={(e) => setConfig(prev => prev ? { ...prev, faviconUrl: e.target.value } : null)}
                                className="h-14 rounded-2xl border-border bg-background focus:ring-indigo-500/20 mb-2"
                              />
                              <div className="relative">
                                <input 
                                  type="file" 
                                  id="favicon-upload" 
                                  className="hidden" 
                                  accept=".png,.jpg,.jpeg,.svg,.ico"
                                  onChange={(e) => handleFileUpload(e, 'faviconUrl')}
                                />
                                <Button 
                                  variant="outline" 
                                  className="w-full h-12 rounded-xl border-dashed border-2"
                                  onClick={() => document.getElementById('favicon-upload')?.click()}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Favicon
                                </Button>
                              </div>
                            </div>
                            {config?.faviconUrl && (
                              <div className="h-28 w-28 rounded-2xl border border-border bg-muted flex items-center justify-center p-2 overflow-hidden">
                                <img src={config.faviconUrl} alt="Favicon Preview" className="max-w-full max-h-full object-contain" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-indigo-600" />
                        Logo Asset
                      </label>
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Logo URL or Upload</Label>
                            <Input 
                              placeholder="https://example.com/logo.png"
                              value={config?.logoUrl || ''}
                              onChange={(e) => setConfig(prev => prev ? { ...prev, logoUrl: e.target.value } : null)}
                              className="h-14 rounded-2xl border-border bg-background focus:ring-indigo-500/20 mb-2"
                            />
                            <div className="relative">
                              <input 
                                type="file" 
                                id="logo-upload" 
                                className="hidden" 
                                accept=".png,.jpg,.jpeg,.svg"
                                onChange={(e) => handleFileUpload(e, 'logoUrl')}
                              />
                              <Button 
                                variant="outline" 
                                className="w-full h-12 rounded-xl border-dashed border-2"
                                onClick={() => document.getElementById('logo-upload')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload from PC
                              </Button>
                            </div>
                          </div>
                          {config?.logoUrl && (
                            <div className="h-28 w-28 rounded-2xl border border-border bg-muted flex items-center justify-center p-2 overflow-hidden">
                              <img src={config.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                            </div>
                          )}
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Sidebar Logo (Dark Backgrounds)</Label>
                            <Input 
                              placeholder="https://example.com/sidebar-logo.png"
                              value={config?.sidebarLogoUrl || ''}
                              onChange={(e) => setConfig(prev => prev ? { ...prev, sidebarLogoUrl: e.target.value } : null)}
                              className="h-14 rounded-2xl border-border bg-background focus:ring-indigo-500/20 mb-2"
                            />
                            <div className="relative">
                              <input 
                                type="file" 
                                id="sidebar-logo-upload" 
                                className="hidden" 
                                accept=".png,.jpg,.jpeg,.svg"
                                onChange={(e) => handleFileUpload(e, 'sidebarLogoUrl')}
                              />
                              <Button 
                                variant="outline" 
                                className="w-full h-12 rounded-xl border-dashed border-2"
                                onClick={() => document.getElementById('sidebar-logo-upload')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Sidebar Logo
                              </Button>
                            </div>
                          </div>
                          {config?.sidebarLogoUrl && (
                            <div className="h-28 w-28 rounded-2xl border border-border bg-brand flex items-center justify-center p-2 overflow-hidden">
                              <img src={config.sidebarLogoUrl} alt="Sidebar Logo Preview" className="max-w-full max-h-full object-contain" />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border">
                          <div 
                            className="h-12 w-12 rounded-xl border border-border shadow-sm"
                            style={{ backgroundColor: config?.brandColor || '#4f46e5' }}
                          />
                          <div className="flex-1">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Brand Color</Label>
                            <div className="flex gap-2">
                              <Input 
                                type="text"
                                value={config?.brandColor || '#4f46e5'}
                                onChange={(e) => setConfig(prev => prev ? { ...prev, brandColor: e.target.value } : null)}
                                className="h-10 rounded-lg border-border bg-background"
                              />
                              <Input 
                                type="color"
                                value={config?.brandColor || '#4f46e5'}
                                onChange={(e) => setConfig(prev => prev ? { ...prev, brandColor: e.target.value } : null)}
                                className="h-10 w-12 p-1 rounded-lg border-border bg-background cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                              <Type className="h-5 w-5" />
                            </div>
                            <div>
                              <Label className="text-sm font-bold block">Hide Brand Name</Label>
                              <p className="text-[10px] text-muted-foreground">Don't show "IzyFlow" next to logo</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setConfig(prev => prev ? { ...prev, hideBrandName: !prev.hideBrandName } : null)}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative",
                              config?.hideBrandName ? "bg-indigo-600" : "bg-muted border border-border"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 rounded-full transition-all",
                              config?.hideBrandName ? "right-1 bg-white" : "left-1 bg-muted-foreground"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-purple-600" />
                      Hero Image Asset
                    </label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Input 
                          placeholder="https://example.com/hero.jpg"
                          value={config?.heroImageUrl || ''}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, heroImageUrl: e.target.value } : null)}
                          className="h-14 rounded-2xl border-border bg-background focus:ring-indigo-500/20 mb-2"
                        />
                        <div className="relative">
                          <input 
                            type="file" 
                            id="hero-upload" 
                            className="hidden" 
                            accept=".png,.jpg,.jpeg,.svg"
                            onChange={(e) => handleFileUpload(e, 'heroImageUrl')}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full h-12 rounded-xl border-dashed border-2"
                            onClick={() => document.getElementById('hero-upload')?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload from PC
                          </Button>
                        </div>
                      </div>
                      {config?.heroImageUrl && (
                        <div className="h-28 w-28 rounded-2xl border border-border bg-muted flex items-center justify-center p-2 overflow-hidden">
                          <img src={config.heroImageUrl} alt="Hero Preview" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'typography' && (
              <div className="space-y-10">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Type className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Global Typography</h3>
                    <p className="text-sm text-muted-foreground">Select the primary font family for the entire application.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <Palette className="h-4 w-4 text-purple-600" />
                    Font Family
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {['Satoshi', 'Inter', 'Geist', 'Outfit', 'Space Grotesk', 'Playfair Display', 'JetBrains Mono'].map((font) => (
                      <button
                        key={font}
                        onClick={() => setConfig(prev => prev ? { ...prev, fontFamily: font } : null)}
                        className={cn(
                          "p-6 rounded-2xl border-2 text-left transition-all group",
                          config?.fontFamily === font 
                            ? "border-indigo-600 bg-indigo-50/50" 
                            : "border-border hover:border-indigo-600/30 hover:bg-muted"
                        )}
                        style={{ fontFamily: font }}
                      >
                        <p className="font-bold text-lg mb-1">{font}</p>
                        <p className="text-xs text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cms' && (
              <div className="space-y-10">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Landing Page Copy</h3>
                    <p className="text-sm text-muted-foreground">Edit all headings and subtext visible to public visitors.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid gap-8">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Hero Badge Text</label>
                      <Input 
                        value={config?.heroBadgeText || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, heroBadgeText: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                        placeholder="e.g. Master your money. Build your legacy."
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Hero Heading</label>
                      <Input 
                        value={config?.heroHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, heroHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Hero Subtext</label>
                      <Textarea 
                        value={config?.heroSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, heroSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Features Heading</label>
                      <Input 
                        value={config?.featuresHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, featuresHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Features Subtext</label>
                      <Input 
                        value={config?.featuresSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, featuresSubtext: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Intelligence Heading</label>
                      <Input 
                        value={config?.intelligenceHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, intelligenceHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Intelligence Subtext</label>
                      <Textarea 
                        value={config?.intelligenceSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, intelligenceSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Automation Heading</label>
                      <Input 
                        value={config?.automationHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, automationHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Automation Subtext</label>
                      <Textarea 
                        value={config?.automationSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, automationSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Growth Heading</label>
                      <Input 
                        value={config?.growthHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, growthHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Growth Subtext</label>
                      <Textarea 
                        value={config?.growthSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, growthSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Data Freedom Heading</label>
                      <Input 
                        value={config?.dataFreedomHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, dataFreedomHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Data Freedom Subtext</label>
                      <Textarea 
                        value={config?.dataFreedomSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, dataFreedomSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Simplicity Heading</label>
                      <Input 
                        value={config?.simplicityHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, simplicityHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Simplicity Subtext</label>
                      <Textarea 
                        value={config?.simplicitySubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, simplicitySubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">CTA Heading</label>
                      <Input 
                        value={config?.ctaHeading || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, ctaHeading: e.target.value } : null)}
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">CTA Subtext</label>
                      <Textarea 
                        value={config?.ctaSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, ctaSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid gap-8 pt-8 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Footer Subtext</label>
                      <Textarea 
                        value={config?.footerSubtext || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, footerSubtext: e.target.value } : null)}
                        className="h-32 rounded-2xl border-border bg-background"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-foreground uppercase tracking-widest">Copyright Text</label>
                      <Input 
                        value={config?.copyrightText || ''}
                        onChange={(e) => setConfig(prev => prev ? { ...prev, copyrightText: e.target.value } : null)}
                        placeholder="© 2026 IzyFlow Inc. All rights reserved."
                        className="h-14 rounded-2xl border-border bg-background"
                      />
                    </div>
                  </div>

                  {/* Services Section */}
                  <div className="pt-12 border-t border-border">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-foreground">Services</h3>
                        <p className="text-xs text-muted-foreground">Manage the core services displayed on your landing page.</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {config?.services?.map((service, index) => (
                        <div key={index} className="p-6 rounded-3xl border border-border bg-muted/30 space-y-4 relative group">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 right-4 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const newServices = [...(config.services || [])];
                              newServices.splice(index, 1);
                              setConfig({ ...config, services: newServices });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="grid md:grid-cols-[200px_1fr] gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service Title</label>
                              <Input 
                                value={service.title}
                                onChange={(e) => {
                                  const newServices = [...(config.services || [])];
                                  newServices[index].title = e.target.value;
                                  setConfig({ ...config, services: newServices });
                                }}
                                className="h-12 rounded-xl border-border bg-background"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                              <Input 
                                value={service.description}
                                onChange={(e) => {
                                  const newServices = [...(config.services || [])];
                                  newServices[index].description = e.target.value;
                                  setConfig({ ...config, services: newServices });
                                }}
                                className="h-12 rounded-xl border-border bg-background"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="w-full h-14 rounded-2xl border-dashed border-2"
                        onClick={() => setConfig(prev => prev ? { ...prev, services: [...(prev.services || []), { title: 'New Service', description: 'Service description...', icon: 'Zap' }] } : null)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Service
                      </Button>
                    </div>
                  </div>

                  {/* FAQs Section */}
                  <div className="pt-12 border-t border-border">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                        <HelpCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-foreground">Frequently Asked Questions</h3>
                        <p className="text-xs text-muted-foreground">Manage the FAQ section of your landing page.</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {config?.faqs?.map((faq, index) => (
                        <div key={index} className="p-6 rounded-3xl border border-border bg-muted/30 space-y-4 relative group">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 right-4 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const newFaqs = [...(config.faqs || [])];
                              newFaqs.splice(index, 1);
                              setConfig({ ...config, faqs: newFaqs });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question</label>
                            <Input 
                              value={faq.question}
                              onChange={(e) => {
                                const newFaqs = [...(config.faqs || [])];
                                newFaqs[index].question = e.target.value;
                                setConfig({ ...config, faqs: newFaqs });
                              }}
                              className="h-12 rounded-xl border-border bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Answer</label>
                            <Textarea 
                              value={faq.answer}
                              onChange={(e) => {
                                const newFaqs = [...(config.faqs || [])];
                                newFaqs[index].answer = e.target.value;
                                setConfig({ ...config, faqs: newFaqs });
                              }}
                              className="h-24 rounded-xl border-border bg-background"
                            />
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="w-full h-14 rounded-2xl border-dashed border-2"
                        onClick={() => setConfig(prev => prev ? { ...prev, faqs: [...(prev.faqs || []), { question: 'New Question', answer: '' }] } : null)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New FAQ
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'domain' && (
              <div className="space-y-10">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Globe className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Custom Domain Setup</h3>
                    <p className="text-sm text-muted-foreground">Configure your own domain to point to this application.</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-8 space-y-6">
                  <div className="flex items-center gap-3 text-indigo-600">
                    <ShieldCheck className="h-6 w-6" />
                    <h4 className="text-xl font-black">Domain Connection Guide</h4>
                  </div>
                  
                  <div className="space-y-6 text-muted-foreground leading-relaxed">
                    <p className="text-lg">
                      To connect a custom domain (e.g., <code className="bg-white/50 px-2 py-0.5 rounded font-bold text-indigo-600">www.yourcompany.com</code>), 
                      you must update your DNS records with your domain provider.
                    </p>
                    
                    <div className="grid gap-6">
                      <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <p className="font-bold text-foreground">Enter Your Custom Domain</p>
                            <p className="text-sm">Enter the domain you want to use for your platform.</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-black uppercase text-muted-foreground">Custom Domain</Label>
                              <Input 
                                placeholder="e.g. www.yourcompany.com" 
                                value={config?.customDomain || ''}
                                onChange={(e) => setConfig(prev => prev ? { ...prev, customDomain: e.target.value } : null)}
                                className="rounded-xl border-border bg-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-black uppercase text-muted-foreground">Verification TXT Record (Optional)</Label>
                              <Input 
                                placeholder="e.g. google-site-verification=..." 
                                value={config?.txtRecord || ''}
                                onChange={(e) => setConfig(prev => prev ? { ...prev, txtRecord: e.target.value } : null)}
                                className="rounded-xl border-border bg-white"
                              />
                            </div>
                          </div>
                          <Button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Domain Settings
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                        <div>
                          <p className="font-bold text-foreground">Access DNS Settings</p>
                          <p>Log in to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.) and find the DNS management section.</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                        <div>
                          <p className="font-bold text-foreground">Add DNS Records</p>
                          <p>Create the following records in your DNS settings:</p>
                          <div className="mt-4 space-y-4">
                            <div className="p-4 rounded-xl bg-white border border-border">
                              <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-black uppercase text-muted-foreground">CNAME Record</p>
                                <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 text-indigo-600">Required</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Host</p>
                                  <p className="font-mono text-indigo-600 font-bold">www</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Points To</p>
                                  <p className="font-mono text-indigo-600 font-bold">{window.location.hostname}</p>
                                </div>
                              </div>
                            </div>

                            {config?.txtRecord && (
                              <div className="p-4 rounded-xl bg-white border border-border">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-[10px] font-black uppercase text-muted-foreground">TXT Record</p>
                                  <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-600">Verification</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Host</p>
                                    <p className="font-mono text-indigo-600 font-bold">@</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Value</p>
                                    <p className="font-mono text-indigo-600 font-bold">{config.txtRecord}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">4</div>
                        <div>
                          <p className="font-bold text-foreground">Wait for Propagation</p>
                          <p>DNS changes can take anywhere from a few minutes to 48 hours to propagate globally.</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-indigo-500/10">
                      <Button 
                        variant="outline" 
                        className="w-full h-14 rounded-2xl border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 font-bold"
                        onClick={() => window.open('https://cloud.google.com/run/docs/mapping-custom-domains', '_blank')}
                      >
                        View Advanced Technical Documentation
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-10">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Platform Intelligence</h3>
                    <p className="text-sm text-muted-foreground">Monitor adoption, engagement, and automated assistant health.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card className="p-6 rounded-3xl border-border bg-muted/30">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Total Users</p>
                    <p className="text-3xl font-black text-foreground">{allUsers.length}</p>
                  </Card>
                  <Card className="p-6 rounded-3xl border-border bg-muted/30">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Total Visits</p>
                    <p className="text-3xl font-black text-foreground">{visits.length}</p>
                  </Card>
                  <Card className="p-6 rounded-3xl border-border bg-muted/30">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Izy Queries</p>
                    <p className="text-3xl font-black text-blue-600">{izyQueries.length}</p>
                  </Card>
                  <Card className="p-6 rounded-3xl border-border bg-muted/30">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Assistant Errors</p>
                    <p className={cn("text-3xl font-black", izyErrors.length > 0 ? "text-rose-600" : "text-green-600")}>
                      {izyErrors.length}
                    </p>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Recent Queries */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                      <h4 className="text-lg font-black text-foreground tracking-tight">Recent Izy Conversations</h4>
                    </div>
                    <div className="rounded-3xl border border-border bg-card overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Query</TableHead>
                              <TableHead className="text-right">Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {izyQueries.map((q) => {
                              const user = allUsers.find(u => u.uid === q.userId);
                              return (
                                <TableRow key={q.id}>
                                  <TableCell className="text-xs font-bold">{user?.displayName || 'Unknown'}</TableCell>
                                  <TableCell className="text-xs truncate max-w-[200px]">{q.query}</TableCell>
                                  <TableCell className="text-[10px] text-right text-muted-foreground">
                                    {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {izyQueries.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No recent conversations</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  {/* System Errors */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                      <h4 className="text-lg font-black text-foreground tracking-tight">AI System Alerts</h4>
                    </div>
                    <div className="rounded-3xl border border-border bg-card overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                              <TableHead>Error</TableHead>
                              <TableHead className="text-right">Logged</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {izyErrors.map((e) => (
                              <TableRow key={e.id} className="bg-rose-50/10">
                                <TableCell className="text-[10px] text-rose-700 font-medium">
                                  <p className="font-bold mb-1 truncate max-w-[250px]">{e.error}</p>
                                  <p className="text-muted-foreground italic">Q: {e.query}</p>
                                </TableCell>
                                <TableCell className="text-[10px] text-right text-muted-foreground">
                                  {new Date(e.timestamp).toLocaleTimeString()}
                                </TableCell>
                              </TableRow>
                            ))}
                            {izyErrors.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center py-8 text-green-600 font-bold">All systems nominal</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    <h4 className="text-lg font-black text-foreground tracking-tight">Visitor Traffic</h4>
                  </div>
                  <div className="rounded-3xl border border-border overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead>Device/Agent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visits.map((v) => {
                            const visitor = allUsers.find(u => u.uid === v.userId);
                            return (
                              <TableRow key={v.id}>
                                <TableCell className="text-xs font-medium">{new Date(v.timestamp).toLocaleString()}</TableCell>
                                <TableCell className="text-xs">
                                  {visitor ? (
                                    <div className="flex items-center gap-2">
                                      <img src={visitor.photoURL} className="h-5 w-5 rounded-full" />
                                      <span className="font-bold">{visitor.displayName}</span>
                                    </div>
                                  ) : 'Guest'}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-indigo-600">{v.path}</TableCell>
                                <TableCell className="text-[10px] text-muted-foreground truncate max-w-[200px]">{v.userAgent}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-10">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Team & Users</h3>
                    <p className="text-sm text-muted-foreground">Manage roles, permissions, and monitor user status.</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-border overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Current Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allUsers.sort((a, b) => new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime()).map((u) => (
                          <TableRow key={u.uid}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="h-8 w-8 rounded-full border" />
                                <span className="font-bold">{u.displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              {u.lastSeen ? (
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Last Seen
                                  </span>
                                  <span className="text-xs font-medium">
                                    {new Date(u.lastSeen).toLocaleDateString()} at {new Date(u.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Never logged</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "font-black text-[10px] uppercase",
                                u.role === 'Admin' ? "border-indigo-600 text-indigo-600 bg-indigo-50" :
                                u.role === 'Content Admin' ? "border-amber-600 text-amber-600 bg-amber-50" :
                                "border-slate-400 text-slate-400"
                              )}>
                                {u.role || 'User'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <select 
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={u.role || 'User'}
                                onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)}
                              >
                                <option value="User">User</option>
                                <option value="Content Admin">Content Admin</option>
                                <option value="Admin">Admin</option>
                              </select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
