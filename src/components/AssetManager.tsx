import React, { useState } from 'react';
import type { PersonalAsset, AssetCategory, AssetStatus } from '../types';
import { supabase } from '../supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import {
  Package,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  TrendingUp,
  TrendingDown,
  Trash2,
  AlertCircle,
  Loader2,
  Laptop,
  Car,
  Home,
  Wrench,
  Gem,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { CurrencyLogo } from './CurrencyLogo';

interface AssetManagerProps {
  userId: string;
  assets: PersonalAsset[];
  onAssetsUpdated: () => void;
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  userId,
  assets,
  onAssetsUpdated,
}) => {
  const { formatCurrency, formatDate } = usePreferences();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('Electronics');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const getCategoryIcon = (cat: AssetCategory) => {
    switch (cat) {
      case 'Electronics':
        return <Laptop className="w-4 h-4 text-sky-400" />;
      case 'Vehicles':
        return <Car className="w-4 h-4 text-amber-400" />;
      case 'Real Estate':
        return <Home className="w-4 h-4 text-emerald-400" />;
      case 'Home & Tools':
        return <Wrench className="w-4 h-4 text-violet-400" />;
      case 'Jewelry & Collectibles':
        return <Gem className="w-4 h-4 text-pink-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('personal_assets').insert({
        user_id: userId,
        name: name.trim(),
        category,
        purchase_price: Number(purchasePrice) || 0,
        current_value: Number(currentValue) || Number(purchasePrice) || 0,
        purchase_date: purchaseDate || null,
        warranty_expiry: warrantyExpiry || null,
        serial_number: serialNumber.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        status: 'active',
      });

      if (insertError) throw insertError;

      // Reset
      setName('');
      setCategory('Electronics');
      setPurchasePrice(0);
      setCurrentValue(0);
      setPurchaseDate('');
      setWarrantyExpiry('');
      setSerialNumber('');
      setLocation('');
      setNotes('');
      setIsAdding(false);

      onAssetsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create asset';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (assetId: string, newStatus: AssetStatus) => {
    try {
      await supabase
        .from('personal_assets')
        .update({ status: newStatus })
        .eq('id', assetId);
      onAssetsUpdated();
    } catch (err: unknown) {
      console.error('Error updating asset status:', err);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await supabase.from('personal_assets').delete().eq('id', assetId);
      onAssetsUpdated();
    } catch (err: unknown) {
      console.error('Error deleting asset:', err);
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetAssets = async () => {
    if (assets.length === 0) {
      alert('No assets in vault to reset.');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to reset and delete all ${assets.length} assets from your vault? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.from('personal_assets').delete().eq('user_id', userId);
      if (error) throw error;
      onAssetsUpdated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reset assets');
    } finally {
      setIsResetting(false);
    }
  };

  const activeAssets = assets.filter((a) => a.status === 'active');
  const totalOriginalCost = activeAssets.reduce((sum, a) => sum + Number(a.purchase_price || 0), 0);
  const totalCurrentValue = activeAssets.reduce((sum, a) => sum + Number(a.current_value || 0), 0);
  const deltaValue = totalCurrentValue - totalOriginalCost;
  const deltaPercent = totalOriginalCost > 0 ? (deltaValue / totalOriginalCost) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Assets Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Fixed Asset Value
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(totalCurrentValue)}
            </p>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <span>Feeds directly into Net Worth</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Original Acquisition Cost
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(totalOriginalCost)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {activeAssets.length} active registered items
            </p>
          </div>
          <div className="p-2.5 bg-slate-800 border border-slate-700 text-emerald-400 rounded-xl flex items-center justify-center">
            <CurrencyLogo variant="icon" size="lg" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Value Depreciation / Gain
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                deltaValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {deltaValue >= 0 ? '+' : ''}
              {formatCurrency(deltaValue)}
            </p>
            <p
              className={`text-xs mt-1 flex items-center gap-1 ${
                deltaValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {deltaValue >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{deltaPercent.toFixed(1)}% vs purchase price</span>
            </p>
          </div>
          <div
            className={`p-3 rounded-xl border ${
              deltaValue >= 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {deltaValue >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Main Asset Registry */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Personal Data &amp; Fixed Assets Vault</span>
              <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                ERP Inventory
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Track electronics, vehicles, equipment, warranties, and physical wealth alongside your liquid cash.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetAssets}
              disabled={isResetting || assets.length === 0}
              title="Reset and clear all assets in vault"
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isResetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Reset Assets</span>
            </button>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Close Form' : 'Register New Asset'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Asset Form */}
        {isAdding && (
          <form onSubmit={handleCreateAsset} className="mt-5 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Asset Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro M3, Honda Civic, Sony A7IV"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AssetCategory)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Vehicles">Vehicles</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Home & Tools">Home &amp; Tools</option>
                  <option value="Jewelry & Collectibles">Jewelry &amp; Collectibles</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>Purchase Price</span>
                  <CurrencyLogo variant="badge" />
                </label>
                <div className="relative">
                  <CurrencyLogo variant="input-prefix" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={purchasePrice || ''}
                    onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>Current Estimated Value</span>
                  <CurrencyLogo variant="badge" />
                </label>
                <div className="relative">
                  <CurrencyLogo variant="input-prefix" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Defaults to purchase price"
                    value={currentValue || ''}
                    onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Warranty Expiration
                </label>
                <input
                  type="date"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Serial Number / ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. C02X87..."
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Location / Storage
                </label>
                <input
                  type="text"
                  placeholder="e.g. Home Office, Garage, Vault"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Specs, condition, receipt links..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add to Inventory Vault</span>
              </button>
            </div>
          </form>
        )}

        {/* Asset Cards Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-700" />
              <p>No personal assets registered yet.</p>
              <p className="text-xs text-slate-600 mt-1">
                Add your electronics, car, equipment, or valuables to unlock full Net Worth tracking.
              </p>
            </div>
          ) : (
            assets.map((asset) => {
              const hasWarranty = !!asset.warranty_expiry;
              const warrantyDate = hasWarranty ? new Date(asset.warranty_expiry!) : null;
              const isWarrantyExpired = warrantyDate ? warrantyDate.getTime() < Date.now() : false;
              const diffCost = Number(asset.current_value) - Number(asset.purchase_price);

              return (
                <div
                  key={asset.id}
                  className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                          {getCategoryIcon(asset.category)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-tight">{asset.name}</h3>
                          <span className="text-[11px] text-slate-400">{asset.category}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900 transition cursor-pointer"
                        title="Delete asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Valuation Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-850 my-3">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Current Value
                        </span>
                        <span className="text-base font-bold text-white">
                          {formatCurrency(Number(asset.current_value))}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Acquired At
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          {formatCurrency(Number(asset.purchase_price))}
                        </span>
                        <span
                          className={`text-[10px] block font-medium ${
                            diffCost >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {diffCost >= 0 ? '+' : ''}{formatCurrency(diffCost)}
                        </span>
                      </div>
                    </div>

                    {/* Meta info: Serial, Location, Warranty */}
                    <div className="space-y-1 text-xs text-slate-400">
                      {asset.location && (
                        <p className="flex items-center gap-1.5">
                          <span className="text-slate-500">Location:</span> {asset.location}
                        </p>
                      )}
                      {asset.serial_number && (
                        <p className="flex items-center gap-1.5 truncate">
                          <span className="text-slate-500">S/N:</span> {asset.serial_number}
                        </p>
                      )}
                      {hasWarranty && warrantyDate && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {isWarrantyExpired ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Warranty expired ({formatDate(warrantyDate)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Under warranty until {formatDate(warrantyDate)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {asset.purchase_date
                        ? `Purchased ${formatDate(asset.purchase_date)}`
                        : 'No purchase date'}
                    </span>
                    <select
                      value={asset.status}
                      onChange={(e) => handleUpdateStatus(asset.id, e.target.value as AssetStatus)}
                      className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white"
                    >
                      <option value="active">Active</option>
                      <option value="sold">Sold</option>
                      <option value="donated">Donated</option>
                      <option value="disposed">Disposed</option>
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
