import { useState, useEffect } from 'react';
import { Workspace, CatalogItem, Currency } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Tag, 
  Box, 
  Briefcase, 
  Filter,
  MoreVertical,
  ArrowRight,
  TrendingUp,
  FileText,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from './ui/badge';
import { api } from '../lib/api';

interface CatalogProps {
  workspace: Workspace | null;
  onSelect?: (item: CatalogItem) => void;
  mode?: 'manage' | 'select';
}

export function Catalog({ workspace, onSelect, mode = 'manage' }: CatalogProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Product' | 'Service'>('All');
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'Product' | 'Service'>('Product');

  const fetchItems = async () => {
    if (!workspace) return;
    try {
      setLoading(true);
      const data = await api.getCatalogItems(workspace.id);
      setItems(data);
      localStorage.setItem(`catalog_${workspace.id}`, JSON.stringify(data));
    } catch (error) {
      console.error(error);
      const cached = localStorage.getItem(`catalog_${workspace.id}`);
      if (cached) setItems(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [workspace]);

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesType = typeFilter === 'All' || item.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const handleSubmit = async () => {
    if (!workspace) return;
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      const itemData = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        currency: workspace.currency,
        category: category.trim(),
        type,
        updatedAt: new Date().toISOString()
      };

      if (editingItem) {
        await api.updateCatalogItem(workspace.id, editingItem.id, itemData);
        toast.success('Item updated');
      } else {
        await api.createCatalogItem(workspace.id, {
          ...itemData,
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          createdAt: new Date().toISOString()
        });
        toast.success('Item added to catalog');
      }
      resetForm();
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save item');
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setType('Product');
    setEditingItem(null);
    setIsCreating(false);
  };

  const deleteItem = async (id: string) => {
    if (!workspace) return;
    try {
      await api.deleteCatalogItem(workspace.id, id);
      toast.success('Item removed from catalog');
      fetchItems();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setCategory(item.category);
    setType(item.type);
    setIsCreating(true);
  };

  const shareCatalog = () => {
    if (!workspace) return;
    const url = `${window.location.origin}/catalog/${workspace.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Catalog link copied to clipboard!');
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">Loading catalog...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">Catalog</h2>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
            Inventory of your products & services
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={shareCatalog} className="rounded-xl font-bold border-white/10">
            <Share2 className="h-4 w-4 mr-2 text-purple-400" />
            Share Catalog
          </Button>
          <Button onClick={() => setIsCreating(true)} className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search catalog..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="All">All Types</option>
            <option value="Product">Products</option>
            <option value="Service">Services</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select 
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="group overflow-hidden border-border bg-card/50 hover:border-purple-200 transition-all cursor-default">
            <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn(
                    "text-[10px] font-black uppercase px-1.5 rounded-sm",
                    item.type === 'Product' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                  )}>
                    {item.type}
                  </Badge>
                  {item.category && (
                    <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground/50 border-muted-foreground/20 rounded-sm">
                      {item.category}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-black tracking-tight pt-1">
                  {item.name}
                </CardTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => startEdit(item)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteItem(item.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                  {mode === 'manage' && (
                    <DropdownMenuItem onClick={() => {
                      window.dispatchEvent(new CustomEvent('create-invoice-with-item', { detail: item }));
                    }}>
                      <FileText className="h-4 w-4 mr-2" /> Create Invoice
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-4">
                {item.description || 'No description provided.'}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-lg font-black text-foreground">
                  {item.currency} {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                {mode === 'select' ? (
                  <Button size="sm" onClick={() => onSelect?.(item)} className="rounded-lg font-bold bg-purple-600">
                    Select
                  </Button>
                ) : (
                  <div className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-tighter">
                    Added {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-3xl">
            <Box className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground font-bold italic">No catalog items found</p>
            <Button variant="link" onClick={() => setIsCreating(true)} className="text-purple-600 font-bold">
              Add your first item
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isCreating} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Item' : 'Add Catalog Item'}</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {editingItem ? 'Modify your product or service details' : 'Save a recurring product or service for faster invoicing'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Type</Label>
                <div className="flex bg-muted p-1 rounded-xl">
                  <button 
                    onClick={() => setType('Product')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      type === 'Product' ? "bg-white shadow-sm text-purple-600" : "text-muted-foreground"
                    )}
                  >
                    Product
                  </button>
                  <button 
                    onClick={() => setType('Service')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      type === 'Service' ? "bg-white shadow-sm text-purple-600" : "text-muted-foreground"
                    )}
                  >
                    Service
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Price ({workspace?.currency})</Label>
                <Input 
                  type="number" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Name</Label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Consultancy, Web Design, etc."
                className="rounded-xl font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Category</Label>
              <Input 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Software, Creative, Physical, etc."
                className="rounded-xl font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</Label>
              <Input 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief details about this item"
                className="rounded-xl font-bold"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={resetForm} className="rounded-xl font-bold text-xs uppercase tracking-widest">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 px-6">
              {editingItem ? 'Save Changes' : 'Add to Catalog'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
