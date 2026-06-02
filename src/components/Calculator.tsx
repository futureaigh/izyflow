import { useState, useMemo, useEffect, useRef } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Workspace, PricingType, CalcInputs, PricingCalculation } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { 
  Calculator as CalculatorIcon, 
  ReceiptText, 
  Share2, 
  Info, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Calendar, 
  Repeat, 
  Save, 
  Trash2, 
  History, 
  Camera, 
  ChevronRight, 
  ChevronLeft, 
  Package, 
  Truck, 
  Box, 
  ShieldCheck,
  ArrowRight,
  Plus,
  X,
  AlertTriangle,
  Layers,
  Briefcase,
  Ticket,
  Zap,
  Settings2,
  LayoutGrid,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';

interface CalculatorProps {
  workspace: Workspace | null;
}

const DEFAULT_INPUTS: CalcInputs = {
  pricingType: "SERVICE_PROJECT",
  direct: {
    materials: 0,
    subcontractors: 0,
    packaging: 0,
    delivery: 0,
    transactionFees: 0,
    softwareTools: 0,
    dataItems: [],
  },
  labour: {
    monthlyIncomeTarget: 5000,
    monthlyWorkingHours: 160,
    estimatedJobHours: 10,
  },
  overheads: {
    monthlyOverheadTotal: 1000,
    monthlyJobs: 20,
    items: [],
  },
  equipment: {
    equipmentCost: 2000,
    lifespanMonths: 24,
    items: [],
  },
  adjustments: {
    profitMarginPct: 20,
    riskBufferPct: 5,
    taxPct: 0,
  },
  product: {
    costPerUnit: 10,
    extraCostPerUnit: 2,
    method: "MARKUP",
    percent: 50,
    taxPct: 0,
  },
  event: {
    totalEventCost: 5000,
    expectedAttendees: 100,
    profitMarginPct: 20,
    taxPct: 0,
  },
  retainer: {
    monthlyCostToServe: 2000,
    desiredProfitPct: 30,
    taxPct: 0,
  },
  advanced: {
    enabled: false,
    commissionEnabled: false,
    commissionPct: 10,
    scenariosEnabled: false,
    scenarioAName: "Scenario A",
    scenarioAPct: 20,
    scenarioBName: "Scenario B",
    scenarioBPct: 40,
    subscriptionEnabled: false,
    basicTierName: "Basic",
    basicTierPct: -10,
    standardTierName: "Standard",
    standardTierPct: 0,
    premiumTierName: "Premium",
    premiumTierPct: 20,
  },
};

const clampNonNeg = (n: any) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
};

export function Calculator({ workspace }: CalculatorProps) {
  const [clientName, setClientName] = useState('');
  const [inputs, setInputs] = useState<CalcInputs>(DEFAULT_INPUTS);
  const [savedCalculations, setSavedCalculations] = useState<PricingCalculation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<PricingType>("SERVICE_PROJECT");
  
  const calculationRef = useRef<HTMLDivElement>(null);

  // Persistence: Load from localStorage
  useEffect(() => {
    const key = workspace?.ownerId ? `app:pricing-calculator:${workspace.ownerId}` : "app:pricing-calculator";
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.inputs) {
          setInputs({
            ...DEFAULT_INPUTS,
            ...parsed.inputs,
            direct: { ...DEFAULT_INPUTS.direct, ...parsed.inputs.direct },
            labour: { ...DEFAULT_INPUTS.labour, ...parsed.inputs.labour },
            overheads: { ...DEFAULT_INPUTS.overheads, ...parsed.inputs.overheads },
            equipment: { ...DEFAULT_INPUTS.equipment, ...parsed.inputs.equipment },
            adjustments: { ...DEFAULT_INPUTS.adjustments, ...parsed.inputs.adjustments },
            product: { ...DEFAULT_INPUTS.product, ...parsed.inputs.product },
            event: { ...DEFAULT_INPUTS.event, ...parsed.inputs.event },
            retainer: { ...DEFAULT_INPUTS.retainer, ...parsed.inputs.retainer },
            advanced: { ...DEFAULT_INPUTS.advanced, ...parsed.inputs.advanced },
          });
          if (parsed.inputs.pricingType) setActiveTab(parsed.inputs.pricingType);
        }
        if (parsed.quoteName) setClientName(parsed.quoteName);
      } catch (e) {
        console.error("Failed to parse stored calculator state", e);
      }
    }
  }, [workspace?.ownerId]);

  // Persistence: Save to localStorage with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const key = workspace?.ownerId ? `app:pricing-calculator:${workspace.ownerId}` : "app:pricing-calculator";
      localStorage.setItem(key, JSON.stringify({
        v: 1,
        updatedAt: new Date().toISOString(),
        quoteName: clientName,
        activeQuoteId: null,
        inputs
      }));
    }, 600);
    return () => clearTimeout(timer);
  }, [inputs, clientName, workspace?.ownerId]);

  // Load saved calculations from Firestore
  useEffect(() => {
    if (!workspace) return;

    const q = query(
      collection(db, `workspaces/${workspace.id}/pricingCalculations`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavedCalculations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingCalculation)));
    }, (error) => handleFirestoreError(error, 'list', 'pricingCalculations'));

    return () => unsubscribe();
  }, [workspace]);

  // Calculation Logic
  const results = useMemo<any>(() => {
    const { pricingType, direct, labour, overheads, equipment, adjustments, product, event, retainer, advanced } = inputs;

    if (pricingType === "SERVICE_PROJECT") {
      const dataCostPerJob = direct.dataItems.reduce((sum, it) => sum + clampNonNeg(it.cost), 0);
      const directCosts = clampNonNeg(direct.materials) + clampNonNeg(direct.subcontractors)
        + clampNonNeg(direct.packaging) + clampNonNeg(direct.delivery)
        + clampNonNeg(direct.transactionFees) + clampNonNeg(direct.softwareTools) + dataCostPerJob;

      const hourlyRate = labour.monthlyWorkingHours > 0 ? labour.monthlyIncomeTarget / labour.monthlyWorkingHours : 0;
      const labourCost = labour.estimatedJobHours * hourlyRate;

      const overheadMonthlyTotal = overheads.items.length
        ? overheads.items.reduce((sum, it) => sum + clampNonNeg(it.monthlyCost), 0)
        : clampNonNeg(overheads.monthlyOverheadTotal);
      const overheadAllocation = overheads.monthlyJobs > 0 ? overheadMonthlyTotal / overheads.monthlyJobs : 0;

      const equipmentCostPerJob = equipment.items.length
        ? equipment.items.reduce((sum, it) => {
            const life = clampNonNeg(it.lifespanMonths);
            return overheads.monthlyJobs > 0 && life > 0
              ? sum + clampNonNeg(it.cost) / life / overheads.monthlyJobs : sum;
          }, 0)
        : (overheads.monthlyJobs > 0 && equipment.lifespanMonths > 0)
          ? clampNonNeg(equipment.equipmentCost) / equipment.lifespanMonths / overheads.monthlyJobs : 0;

      const baseCost = directCosts + labourCost + overheadAllocation + equipmentCostPerJob;
      const profitAmount = baseCost * adjustments.profitMarginPct / 100;
      const riskAmount   = baseCost * adjustments.riskBufferPct / 100;
      const taxAmount    = baseCost * adjustments.taxPct / 100;
      const finalPrice = baseCost + profitAmount + riskAmount + taxAmount;

      return { baseCost, profitAmount, riskAmount, taxAmount, finalPrice, hourlyRate };
    }

    if (pricingType === "PRODUCT") {
      const unitCost = clampNonNeg(product.costPerUnit) + clampNonNeg(product.extraCostPerUnit);
      const preTaxPrice = unitCost <= 0 ? 0
        : product.method === "MARGIN"
          ? (product.percent >= 100 ? 0 : unitCost / (1 - product.percent / 100))
          : unitCost * (1 + product.percent / 100);

      const taxAmount = preTaxPrice * product.taxPct / 100;
      const finalPrice = preTaxPrice + taxAmount;
      return { unitCost, preTaxPrice, taxAmount, finalPrice };
    }

    if (pricingType === "EVENT") {
      const costPerTicket = event.expectedAttendees > 0 ? event.totalEventCost / event.expectedAttendees : 0;
      const profitPerTicket = costPerTicket * event.profitMarginPct / 100;
      const taxPerTicket = (costPerTicket + profitPerTicket) * event.taxPct / 100;
      const finalPrice = costPerTicket + profitPerTicket + taxPerTicket;
      return { costPerTicket, profitPerTicket, taxPerTicket, finalPrice };
    }

    if (pricingType === "RETAINER") {
      const calcRetainer = (profitPct: number) => {
        const profitAmount = retainer.monthlyCostToServe * profitPct / 100;
        const preTaxNet = retainer.monthlyCostToServe + profitAmount;
        const preTaxGross = advanced.commissionEnabled && advanced.commissionPct < 100
          ? preTaxNet / (1 - advanced.commissionPct / 100)
          : preTaxNet;
        const commissionAmount = advanced.commissionEnabled ? Math.max(0, preTaxGross - preTaxNet) : 0;
        const taxAmount = preTaxGross * retainer.taxPct / 100;
        return { profitAmount, preTaxGross, commissionAmount, taxAmount, final: preTaxGross + taxAmount };
      };

      const main = calcRetainer(retainer.desiredProfitPct);
      const scenarioA = advanced.scenariosEnabled ? calcRetainer(advanced.scenarioAPct) : null;
      const scenarioB = advanced.scenariosEnabled ? calcRetainer(advanced.scenarioBPct) : null;

      const tiers = advanced.subscriptionEnabled ? {
        basic: main.final * (1 + advanced.basicTierPct / 100),
        standard: main.final * (1 + advanced.standardTierPct / 100),
        premium: main.final * (1 + advanced.premiumTierPct / 100),
      } : null;

      return { ...main, scenarioA, scenarioB, tiers, finalPrice: main.final };
    }

    return { finalPrice: 0 };
  }, [inputs]);

  // Validation / Issue Flags
  const issues = useMemo(() => {
    const { pricingType, labour, overheads, equipment, product, event, retainer, advanced } = inputs;
    const list: string[] = [];

    if (pricingType === "SERVICE_PROJECT") {
      if (labour.monthlyWorkingHours <= 0) list.push("Monthly working hours must be > 0");
      if (overheads.monthlyJobs <= 0) list.push("Monthly jobs must be > 0");
      if (equipment.items.some(it => it.lifespanMonths <= 0)) list.push("Equipment lifespan must be > 0");
      if (results.hourlyRate && results.hourlyRate < 5) list.push("Hourly rate seems very low (< 5)");
      if (results.hourlyRate && results.hourlyRate > 1000) list.push("Hourly rate seems very high (> 1000)");
    } else if (pricingType === "PRODUCT") {
      if (product.costPerUnit + product.extraCostPerUnit <= 0) list.push("Unit cost should be > 0");
      if (product.method === "MARGIN" && product.percent >= 100) list.push("Margin cannot be 100% or more");
    } else if (pricingType === "EVENT") {
      if (event.totalEventCost <= 0) list.push("Total event cost should be > 0");
      if (event.expectedAttendees <= 0) list.push("Expected attendees should be > 0");
    } else if (pricingType === "RETAINER") {
      if (retainer.monthlyCostToServe <= 0) list.push("Monthly cost to serve should be > 0");
      if (advanced.commissionEnabled && advanced.commissionPct >= 100) list.push("Commission cannot be 100% or more");
    }

    return list;
  }, [inputs, results]);

  const updateInput = (path: string, value: any) => {
    setInputs(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      let current: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const addItem = (path: string, newItem: any) => {
    const parts = path.split('.');
    setInputs(prev => {
      const next = { ...prev };
      let current: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = [...current[parts[parts.length - 1]], newItem];
      return next;
    });
  };

  const removeItem = (path: string, id: string) => {
    const parts = path.split('.');
    setInputs(prev => {
      const next = { ...prev };
      let current: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = current[parts[parts.length - 1]].filter((it: any) => it.id !== id);
      return next;
    });
  };

  const saveCalculation = async () => {
    if (!workspace || !clientName) {
      toast.error('Please enter a client or quote name');
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, `workspaces/${workspace.id}/pricingCalculations`), {
        workspaceId: workspace.id,
        clientName,
        pricingType: inputs.pricingType,
        inputs,
        totalPrice: results.finalPrice,
        createdAt: new Date().toISOString()
      });
      toast.success('Calculation saved to history!');
    } catch (error) {
      toast.error('Failed to save calculation');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCalculation = async (id: string) => {
    if (!workspace) return;
    try {
      await deleteDoc(doc(db, `workspaces/${workspace.id}/pricingCalculations`, id));
      toast.success('Calculation removed');
    } catch (error) {
      toast.error('Failed to delete calculation');
    }
  };

  const generateInvoice = async () => {
    if (!workspace || !clientName) {
      toast.error('Please enter a client name');
      return;
    }
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      await addDoc(collection(db, `workspaces/${workspace.id}/invoices`), {
        workspaceId: workspace.id,
        clientName,
        amount: results.finalPrice,
        currency: workspace.currency,
        status: 'Draft',
        createdAt: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
        items: [
          { 
            name: clientName,
            description: `Pricing calculation for ${clientName}`, 
            quantity: 1, 
            price: results.finalPrice 
          }
        ],
        paidAmount: 0,
        introduction: `Proposed pricing for ${clientName} based on our ${inputs.pricingType} model.`
      });
      toast.success('Invoice generated from calculation!');
    } catch (error) {
      toast.error('Failed to generate invoice');
    }
  };

  const saveToCatalog = async () => {
    if (!workspace) return;
    try {
      await addDoc(collection(db, `workspaces/${workspace.id}/catalogItems`), {
        workspaceId: workspace.id,
        name: clientName || `${inputs.pricingType} Solution`,
        description: `Generated from pricing calculator (${inputs.pricingType})`,
        price: results.finalPrice,
        currency: workspace.currency,
        type: (inputs.pricingType === 'PRODUCT' || inputs.pricingType === 'EVENT') ? 'Product' : 'Service',
        category: 'Calculated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('Calculation saved to Catalog!');
    } catch (error) {
      toast.error('Failed to save to Catalog');
    }
  };

  const captureScreenshot = async () => {
    if (!calculationRef.current) return;
    try {
      const canvas = await html2canvas(calculationRef.current, {
        backgroundColor: '#050505',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `izyflow-quote-${clientName || 'calculation'}.png`;
      link.click();
      toast.success('Screenshot saved!');
    } catch (error) {
      toast.error('Failed to capture screenshot');
    }
  };

  if (!workspace) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-foreground">Pricing Calculator</h2>
          <p className="text-muted-foreground font-medium">Advanced multi-mode pricing engine for your business.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={captureScreenshot} className="rounded-xl border-border bg-card hover:bg-muted">
            <Camera className="mr-2 h-4 w-4" />
            Screenshot
          </Button>
          <Button 
            onClick={saveCalculation}
            disabled={isSaving || !clientName}
            className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90 font-bold px-6"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Calculation"}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="border-border bg-card/50 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/30">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand flex items-center justify-center text-white">
                    <CalculatorIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black">Configure Quote</CardTitle>
                    <CardDescription>Select your pricing model and enter details</CardDescription>
                  </div>
                </div>
                
                <Tabs value={activeTab} onValueChange={(v) => {
                  setActiveTab(v as PricingType);
                  updateInput('pricingType', v);
                }} className="w-full">
                  <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto bg-muted/50 p-1 rounded-2xl gap-1">
                    <TabsTrigger value="SERVICE_PROJECT" className="rounded-xl py-3 font-bold text-[10px] uppercase tracking-wider flex flex-col gap-1">
                      <Briefcase className="h-4 w-4" /> Service
                    </TabsTrigger>
                    <TabsTrigger value="PRODUCT" className="rounded-xl py-3 font-bold text-[10px] uppercase tracking-wider flex flex-col gap-1">
                      <Package className="h-4 w-4" /> Product
                    </TabsTrigger>
                    <TabsTrigger value="EVENT" className="rounded-xl py-3 font-bold text-[10px] uppercase tracking-wider flex flex-col gap-1">
                      <Ticket className="h-4 w-4" /> Event
                    </TabsTrigger>
                    <TabsTrigger value="RETAINER" className="rounded-xl py-3 font-bold text-[10px] uppercase tracking-wider flex flex-col gap-1">
                      <Repeat className="h-4 w-4" /> Retainer
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quote / Client Name</Label>
                <Input 
                  placeholder="e.g. Website Overhaul - Acme Corp" 
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="h-14 rounded-2xl border-border bg-background text-lg font-bold"
                />
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "SERVICE_PROJECT" && (
                  <motion.div 
                    key="service"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <Layers className="h-4 w-4" /> Direct Costs
                        </h4>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Materials</Label>
                            <Input type="number" value={inputs.direct.materials} onChange={(e) => updateInput('direct.materials', Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Subcontractors</Label>
                            <Input type="number" value={inputs.direct.subcontractors} onChange={(e) => updateInput('direct.subcontractors', Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Software/Tools</Label>
                            <Input type="number" value={inputs.direct.softwareTools} onChange={(e) => updateInput('direct.softwareTools', Number(e.target.value))} />
                          </div>
                          
                          <div className="pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] font-bold uppercase">Additional Items</Label>
                              <Button variant="ghost" size="sm" onClick={() => addItem('direct.dataItems', { id: Math.random().toString(36).substr(2, 9), name: '', cost: 0 })} className="h-6 text-[10px] font-black uppercase">
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </div>
                            {inputs.direct.dataItems.map((it, idx) => (
                              <div key={it.id} className="flex gap-2">
                                <Input placeholder="Item Name" value={it.name} onChange={(e) => {
                                  const newList = [...inputs.direct.dataItems];
                                  newList[idx].name = e.target.value;
                                  updateInput('direct.dataItems', newList);
                                }} className="flex-1" />
                                <Input type="number" placeholder="Cost" value={it.cost} onChange={(e) => {
                                  const newList = [...inputs.direct.dataItems];
                                  newList[idx].cost = Number(e.target.value);
                                  updateInput('direct.dataItems', newList);
                                }} className="w-24" />
                                <Button variant="ghost" size="icon" onClick={() => removeItem('direct.dataItems', it.id)} className="h-10 w-10 text-rose-500">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Labour & Time
                        </h4>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Monthly Income Target</Label>
                            <Input type="number" value={inputs.labour.monthlyIncomeTarget} onChange={(e) => updateInput('labour.monthlyIncomeTarget', Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Monthly Working Hours</Label>
                            <Input type="number" value={inputs.labour.monthlyWorkingHours} onChange={(e) => updateInput('labour.monthlyWorkingHours', Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Estimated Job Hours</Label>
                            <Input type="number" value={inputs.labour.estimatedJobHours} onChange={(e) => updateInput('labour.estimatedJobHours', Number(e.target.value))} />
                          </div>
                          <div className="p-4 rounded-xl bg-muted/50 border border-border">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Calculated Hourly Rate</p>
                            <p className="text-xl font-black text-brand">{workspace.currency} {results.hourlyRate?.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-border">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" /> Overheads
                        </h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Monthly Overheads (Total)</Label>
                            <Input type="number" value={inputs.overheads.monthlyOverheadTotal} onChange={(e) => updateInput('overheads.monthlyOverheadTotal', Number(e.target.value))} disabled={inputs.overheads.items.length > 0} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Monthly Jobs/Volume</Label>
                            <Input type="number" value={inputs.overheads.monthlyJobs} onChange={(e) => updateInput('overheads.monthlyJobs', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" /> Adjustments
                        </h4>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-[10px] font-bold uppercase">Profit Margin ({inputs.adjustments.profitMarginPct}%)</Label>
                            </div>
                            <Slider value={[inputs.adjustments.profitMarginPct]} onValueChange={(v) => updateInput('adjustments.profitMarginPct', v[0])} max={100} step={1} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-[10px] font-bold uppercase">Risk Buffer ({inputs.adjustments.riskBufferPct}%)</Label>
                            </div>
                            <Slider value={[inputs.adjustments.riskBufferPct]} onValueChange={(v) => updateInput('adjustments.riskBufferPct', v[0])} max={50} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Tax Percentage (%)</Label>
                            <Input type="number" value={inputs.adjustments.taxPct} onChange={(e) => updateInput('adjustments.taxPct', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "PRODUCT" && (
                  <motion.div 
                    key="product"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <Box className="h-4 w-4" /> Unit Costs
                        </h4>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Cost Per Unit</Label>
                            <Input type="number" value={inputs.product.costPerUnit} onChange={(e) => updateInput('product.costPerUnit', Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Extra Costs (Shipping, etc)</Label>
                            <Input type="number" value={inputs.product.extraCostPerUnit} onChange={(e) => updateInput('product.extraCostPerUnit', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" /> Pricing Strategy
                        </h4>
                        <div className="grid gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Method</Label>
                            <Tabs value={inputs.product.method} onValueChange={(v) => updateInput('product.method', v)} className="w-full">
                              <TabsList className="grid grid-cols-2 h-10 bg-muted/50 p-1 rounded-xl">
                                <TabsTrigger value="MARKUP" className="rounded-lg text-[10px] font-bold uppercase">Markup</TabsTrigger>
                                <TabsTrigger value="MARGIN" className="rounded-lg text-[10px] font-bold uppercase">Margin</TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                          <div className="space-y-4">
                            <div className="flex justify-between">
                              <Label className="text-[10px] font-bold uppercase">{inputs.product.method} Percentage ({inputs.product.percent}%)</Label>
                            </div>
                            <Slider value={[inputs.product.percent]} onValueChange={(v) => updateInput('product.percent', v[0])} max={inputs.product.method === 'MARGIN' ? 99 : 500} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Tax (%)</Label>
                            <Input type="number" value={inputs.product.taxPct} onChange={(e) => updateInput('product.taxPct', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "EVENT" && (
                  <motion.div 
                    key="event"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <Ticket className="h-4 w-4" /> Event Details
                        </h4>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Total Event Cost</Label>
                            <Input type="number" value={inputs.event.totalEventCost} onChange={(e) => updateInput('event.totalEventCost', Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Expected Attendees</Label>
                            <Input type="number" value={inputs.event.expectedAttendees} onChange={(e) => updateInput('event.expectedAttendees', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" /> Profit & Tax
                        </h4>
                        <div className="grid gap-6">
                          <div className="space-y-4">
                            <div className="flex justify-between">
                              <Label className="text-[10px] font-bold uppercase">Profit Margin ({inputs.event.profitMarginPct}%)</Label>
                            </div>
                            <Slider value={[inputs.event.profitMarginPct]} onValueChange={(v) => updateInput('event.profitMarginPct', v[0])} max={200} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Tax (%)</Label>
                            <Input type="number" value={inputs.event.taxPct} onChange={(e) => updateInput('event.taxPct', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "RETAINER" && (
                  <motion.div 
                    key="retainer"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                          <Repeat className="h-4 w-4" /> Monthly Retainer
                        </h4>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Monthly Cost to Serve</Label>
                            <Input type="number" value={inputs.retainer.monthlyCostToServe} onChange={(e) => updateInput('retainer.monthlyCostToServe', Number(e.target.value))} />
                          </div>
                          <div className="space-y-4">
                            <div className="flex justify-between">
                              <Label className="text-[10px] font-bold uppercase">Desired Profit ({inputs.retainer.desiredProfitPct}%)</Label>
                            </div>
                            <Slider value={[inputs.retainer.desiredProfitPct]} onValueChange={(v) => updateInput('retainer.desiredProfitPct', v[0])} max={200} step={1} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase">Tax (%)</Label>
                            <Input type="number" value={inputs.retainer.taxPct} onChange={(e) => updateInput('retainer.taxPct', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest text-brand flex items-center gap-2">
                            <Settings2 className="h-4 w-4" /> Advanced Features
                          </h4>
                          <Switch checked={inputs.advanced.enabled} onCheckedChange={(v) => updateInput('advanced.enabled', v)} />
                        </div>
                        
                        <AnimatePresence>
                          {inputs.advanced.enabled && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid gap-6 overflow-hidden"
                            >
                              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] font-bold uppercase">Platform Commission</Label>
                                  <Switch checked={inputs.advanced.commissionEnabled} onCheckedChange={(v) => updateInput('advanced.commissionEnabled', v)} />
                                </div>
                                {inputs.advanced.commissionEnabled && (
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase">Commission %</Label>
                                    <Input type="number" value={inputs.advanced.commissionPct} onChange={(e) => updateInput('advanced.commissionPct', Number(e.target.value))} />
                                  </div>
                                )}
                              </div>

                              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] font-bold uppercase">Scenario Comparison</Label>
                                  <Switch checked={inputs.advanced.scenariosEnabled} onCheckedChange={(v) => updateInput('advanced.scenariosEnabled', v)} />
                                </div>
                                {inputs.advanced.scenariosEnabled && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label className="text-[10px] font-bold uppercase">Scenario A %</Label>
                                      <Input type="number" value={inputs.advanced.scenarioAPct} onChange={(e) => updateInput('advanced.scenarioAPct', Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-[10px] font-bold uppercase">Scenario B %</Label>
                                      <Input type="number" value={inputs.advanced.scenarioBPct} onChange={(e) => updateInput('advanced.scenarioBPct', Number(e.target.value))} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] font-bold uppercase">Subscription Tiers</Label>
                                  <Switch checked={inputs.advanced.subscriptionEnabled} onCheckedChange={(v) => updateInput('advanced.subscriptionEnabled', v)} />
                                </div>
                                {inputs.advanced.subscriptionEnabled && (
                                  <div className="grid gap-3">
                                    <div className="flex gap-2">
                                      <Input placeholder="Basic Tier" value={inputs.advanced.basicTierName} onChange={(e) => updateInput('advanced.basicTierName', e.target.value)} className="flex-1" />
                                      <Input type="number" value={inputs.advanced.basicTierPct} onChange={(e) => updateInput('advanced.basicTierPct', Number(e.target.value))} className="w-20" />
                                    </div>
                                    <div className="flex gap-2">
                                      <Input placeholder="Standard Tier" value={inputs.advanced.standardTierName} onChange={(e) => updateInput('advanced.standardTierName', e.target.value)} className="flex-1" />
                                      <Input type="number" value={inputs.advanced.standardTierPct} onChange={(e) => updateInput('advanced.standardTierPct', Number(e.target.value))} className="w-20" />
                                    </div>
                                    <div className="flex gap-2">
                                      <Input placeholder="Premium Tier" value={inputs.advanced.premiumTierName} onChange={(e) => updateInput('advanced.premiumTierName', e.target.value)} className="flex-1" />
                                      <Input type="number" value={inputs.advanced.premiumTierPct} onChange={(e) => updateInput('advanced.premiumTierPct', Number(e.target.value))} className="w-20" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {issues.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Calculation Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {issues.map((issue, idx) => (
                      <li key={idx} className="text-[10px] font-bold text-amber-600 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-amber-400" /> {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div ref={calculationRef}>
            <Card className="border-border bg-brand text-brand-foreground shadow-2xl shadow-brand/20 rounded-[2.5rem] overflow-hidden sticky top-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-brand-foreground/70 text-xs font-black uppercase tracking-widest">Final Quote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-1">
                  <p className="text-5xl font-black tracking-tighter">
                    {workspace.currency} {results.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-brand-foreground/80 text-sm font-medium">Recommended Selling Price</p>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/10">
                  {activeTab === "SERVICE_PROJECT" && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-foreground/70">Base Cost</span>
                        <span className="font-bold">{workspace.currency} {results.baseCost?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-foreground/70">Profit Amount</span>
                        <span className="font-bold text-emerald-300">+{workspace.currency} {results.profitAmount?.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {activeTab === "PRODUCT" && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-foreground/70">Unit Cost</span>
                        <span className="font-bold">{workspace.currency} {results.unitCost?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-foreground/70">Pre-Tax Price</span>
                        <span className="font-bold">{workspace.currency} {results.preTaxPrice?.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {activeTab === "RETAINER" && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-brand-foreground/70">Profit Amount</span>
                        <span className="font-bold text-emerald-300">+{workspace.currency} {results.profitAmount?.toLocaleString()}</span>
                      </div>
                      {inputs.advanced.commissionEnabled && (
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-foreground/70">Commission</span>
                          <span className="font-bold text-rose-300">-{workspace.currency} {results.commissionAmount?.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-foreground/70">Tax Amount</span>
                    <span className="font-bold">{workspace.currency} {results.taxAmount?.toLocaleString()}</span>
                  </div>
                </div>

                {activeTab === "RETAINER" && inputs.advanced.subscriptionEnabled && results.tiers && (
                  <div className="space-y-3 pt-6 border-t border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-foreground/50">Subscription Tiers</p>
                    <div className="grid gap-2">
                      <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                        <span className="text-xs font-bold">{inputs.advanced.basicTierName}</span>
                        <span className="font-black">{workspace.currency} {results.tiers.basic.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-white/10 border border-white/20">
                        <span className="text-xs font-bold">{inputs.advanced.standardTierName}</span>
                        <span className="font-black">{workspace.currency} {results.tiers.standard.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                        <span className="text-xs font-bold">{inputs.advanced.premiumTierName}</span>
                        <span className="font-black">{workspace.currency} {results.tiers.premium.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white/10 rounded-2xl p-4 flex gap-3 items-start">
                  <Zap className="h-5 w-5 text-brand-foreground/70 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-brand-foreground/90 italic">
                    {activeTab === "PRODUCT" && inputs.product.method === "MARGIN" 
                      ? "Margin pricing ensures your profit is a fixed percentage of the final selling price."
                      : "Cost-plus pricing ensures all expenses are covered before applying your profit margin."}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={saveToCatalog}
                    variant="outline"
                    className="flex-1 h-16 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 font-black text-xs uppercase tracking-widest"
                  >
                    <Save className="mr-2 h-5 w-5" />
                    Save to Catalog
                  </Button>
                  <Button 
                    onClick={generateInvoice} 
                    className="flex-[2] h-16 rounded-2xl bg-white text-brand hover:bg-white/90 font-black text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ReceiptText className="mr-2 h-5 w-5" />
                    Generate Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {activeTab === "RETAINER" && inputs.advanced.scenariosEnabled && results.scenarioA && results.scenarioB && (
            <div className="p-6 rounded-3xl bg-muted/50 border border-border space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Scenario Comparison</h4>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>{inputs.advanced.scenarioAName} ({inputs.advanced.scenarioAPct}%)</span>
                    <span className="text-brand">{workspace.currency} {results.scenarioA.final.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand/40" style={{ width: `${(results.scenarioA.final / results.finalPrice) * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>{inputs.advanced.scenarioBName} ({inputs.advanced.scenarioBPct}%)</span>
                    <span className="text-brand">{workspace.currency} {results.scenarioB.final.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand/60" style={{ width: `${(results.scenarioB.final / results.finalPrice) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {savedCalculations.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
              <History className="h-4 w-4" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Recent Calculations</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedCalculations.map((calc) => (
              <Card key={calc.id} className="border-border bg-card/50 hover:bg-card transition-colors rounded-2xl overflow-hidden group">
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-foreground truncate max-w-[150px]">{calc.clientName}</h4>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{calc.pricingType}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => deleteCalculation(calc.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-foreground">{workspace.currency} {calc.totalPrice.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{workspace.currency}</span>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {format(new Date(calc.createdAt), 'MMM d, yyyy')}
                    </span>
                    <Button 
                      variant="link" 
                      onClick={() => {
                        setInputs(calc.inputs);
                        setClientName(calc.clientName);
                        setActiveTab(calc.pricingType);
                        toast.info(`Loaded calculation for ${calc.clientName}`);
                      }}
                      className="h-auto p-0 text-brand font-bold text-xs"
                    >
                      Load Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
