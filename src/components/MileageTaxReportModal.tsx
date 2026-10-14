import React from 'react';
import type { MobilityTimelineEvent } from '../types';
import { exportMileageReportCsv } from '../services/locationMobilityService';
import {
  Briefcase,
  Download,
  Printer,
  X,
  FileText,
} from 'lucide-react';

interface MileageTaxReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: MobilityTimelineEvent[];
  rate: number;
  unit: 'km' | 'miles';
  currencySymbol: string;
  userEmail?: string;
}

export const MileageTaxReportModal: React.FC<MileageTaxReportModalProps> = ({
  isOpen,
  onClose,
  events,
  rate,
  unit,
  currencySymbol,
  userEmail,
}) => {
  if (!isOpen) return null;

  const tripEvents = events.filter((e) => e.event_type === 'trip');

  let totalBizDistance = 0;
  let totalPersonalDistance = 0;
  let bizCount = 0;

  const analyzedTrips = tripEvents.map((ev) => {
    const rawKm = Number(ev.distance_km || 0);
    const convertedDistance = unit === 'miles' ? rawKm * 0.621371 : rawKm;
    const isBiz = ev.is_business_trip ?? (ev.mode === 'vehicle');
    const deduction = isBiz ? convertedDistance * rate : 0;

    if (isBiz) {
      totalBizDistance += convertedDistance;
      bizCount++;
    } else {
      totalPersonalDistance += convertedDistance;
    }

    return {
      ...ev,
      convertedDistance,
      isBiz,
      deduction,
    };
  });

  const totalDeduction = totalBizDistance * rate;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    exportMileageReportCsv(events, rate, currencySymbol, unit);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl relative my-8 p-5 sm:p-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Mileage &amp; Commute Tax Report
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Tax Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compliant audit trail for business travel deductions and employer expense reimbursement.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Sheet Container */}
        <div className="mt-4 overflow-y-auto space-y-6 flex-1 pr-1 print:p-0 print:m-0 print:overflow-visible">
          {/* Sheet Header Information */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Taxpayer / Employee Record
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {userEmail || 'Apex LifeOS User'}
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Report Date
                </span>
                <span className="text-xs text-slate-300">
                  {new Date().toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Total Eligible Deduction</span>
                <span className="text-lg font-bold text-emerald-400">
                  {currencySymbol}{totalDeduction.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Business Distance</span>
                <span className="text-lg font-bold text-white">
                  {totalBizDistance.toFixed(1)} {unit}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Standard Rate</span>
                <span className="text-lg font-bold text-indigo-400">
                  {currencySymbol}{rate.toFixed(2)} / {unit}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Business Trips</span>
                <span className="text-lg font-bold text-amber-400">
                  {bizCount} <span className="text-xs text-slate-500 font-normal">of {tripEvents.length}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Itemized Trips Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Itemized Commute &amp; Travel Log ({tripEvents.length} entries)
            </h4>

            {tripEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic bg-slate-950/60 rounded-2xl border border-slate-800">
                No trip records found on this device yet. Start GPS tracking or route simulation to record commute legs.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] font-semibold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Trip Title</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3 text-right">Distance</th>
                      <th className="py-2.5 px-3 text-right">Tax Deduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {analyzedTrips.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                          {new Date(t.start_time).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          {new Date(t.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 text-white font-medium">
                          {t.title}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              t.isBiz
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Briefcase className="w-2.5 h-2.5" />
                            <span>{t.isBiz ? 'Business' : 'Personal'}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">
                          {t.convertedDistance.toFixed(2)} {unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {t.isBiz ? (
                            <span className="text-emerald-400">
                              +{currencySymbol}{t.deduction.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900/90 font-bold border-t border-slate-800 text-white">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-right text-slate-400 uppercase text-[10px]">
                        Total Eligible Tax Deduction:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white">
                        {totalBizDistance.toFixed(2)} {unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 text-sm">
                        {currencySymbol}{totalDeduction.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
