import { Workspace, UserProfile, CMSConfig } from '../types';
import { LOGO_URL } from '../constants';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  ReceiptText, 
  ArrowLeftRight, 
  Wallet,
  Settings as SettingsIcon, 
  Calculator as CalculatorIcon, 
  LogOut, 
  Plus, 
  Building2, 
  User as UserIcon, 
  Heart,
  ChevronDown,
  Bot,
  CreditCard,
  HelpCircle,
  MessageCircle,
  BookOpen,
  Receipt,
  Users
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: UserProfile;
  onSignOut: () => void;
  onIzyClick: () => void;
  onSupportClick: () => void;
  onCreateWorkspace: () => void;
  config: CMSConfig | null;
}

export function Sidebar({ 
  workspaces, 
  activeWorkspace, 
  setActiveWorkspace, 
  activeTab, 
  setActiveTab, 
  user, 
  onSignOut,
  onIzyClick,
  onSupportClick,
  onCreateWorkspace,
  config
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'invoices', label: 'Invoices', icon: ReceiptText, businessOnly: true },
    { id: 'receipts', label: 'Staff Receipts', icon: Receipt, businessOnly: true },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'calculator', label: 'Price Calculator', icon: CalculatorIcon, businessOnly: true, agencyOnly: true },
    { id: 'catalog', label: 'Catalog', icon: BookOpen, businessOnly: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ].filter(item => {
    if (item.businessOnly && activeWorkspace?.type !== 'Business') return false;
    if (item.agencyOnly && user?.subscription?.plan !== 'Agency') return false;
    return true;
  });

  const getWorkspaceIcon = (ws: Workspace | null) => {
    if (ws?.logoUrl) {
      return <img src={ws.logoUrl} alt={ws.name} className="h-4 w-4 rounded-sm object-contain" />;
    }
    switch (ws?.type) {
      case 'Business': return <Building2 className="h-4 w-4" />;
      case 'Personal': return <UserIcon className="h-4 w-4" />;
      case 'NGO': return <Heart className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  return (
    <aside 
      className="flex h-full w-full flex-col border-r border-white/10 p-4 transition-colors duration-500 bg-brand"
    >
      <div className="mb-8 flex items-center gap-3 px-2">
        {config?.sidebarLogoUrl || config?.logoUrl || LOGO_URL ? (
          <img src={config?.sidebarLogoUrl || config?.logoUrl || LOGO_URL} alt="Logo" className="h-8 w-auto object-contain brightness-0 invert" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white font-bold">
            <LayoutDashboard className="h-4 w-4" />
          </div>
        )}
        {!config?.hideBrandName && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">IzyFlow</span>
            <span className="bg-white/20 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Beta</span>
          </div>
        )}
      </div>

      <div className="mb-8" id="tour-workspace">
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="outline" className="w-full justify-between border-white/20 bg-white/10 text-white hover:bg-white/20">
              <div className="flex items-center gap-2 truncate">
                {getWorkspaceIcon(activeWorkspace)}
                <span className="truncate">{activeWorkspace?.name || 'Select Workspace'}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          } />
          <DropdownMenuContent className="w-56 bg-white border-border text-slate-900">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              {workspaces.map((ws) => (
                <DropdownMenuItem 
                  key={ws.id} 
                  onClick={() => setActiveWorkspace(ws)}
                  className="flex items-center gap-2 focus:bg-slate-100"
                >
                  {getWorkspaceIcon(ws)}
                  <span>{ws.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem 
              onClick={onCreateWorkspace}
              className="flex items-center gap-2 text-slate-500 focus:bg-slate-100 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 space-y-1" id="tour-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
              activeTab === item.id 
                ? "bg-white text-slate-900 shadow-lg shadow-black/10" 
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className={cn("h-4 w-4", activeTab === item.id ? "text-brand" : "text-white/60")} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
        <button
          onClick={() => setActiveTab('subscription')}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all border",
            activeTab === 'subscription'
              ? "bg-white text-slate-900 shadow-lg"
              : "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border-indigo-500/30"
          )}
        >
          <CreditCard className="h-5 w-5" />
          Subscription
        </button>

        <button
          onClick={onSupportClick}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-all bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30"
        >
          <MessageCircle className="h-5 w-5" />
          WhatsApp Support
        </button>

        <div className="flex items-center gap-3 px-2 py-2">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
            alt="User" 
            className="h-8 w-8 rounded-full border border-white/20"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
            <p className="truncate text-[10px] text-white/50">{user.email}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSignOut}
            className="text-white/60 hover:bg-white/10 hover:text-white flex items-center gap-2 px-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs font-bold">Sign Out</span>
          </Button>
          {user.role === 'Admin' && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/admin-portal'}
              className="text-xs text-white/80 hover:bg-white/10"
            >
              Admin
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
