import React, { useState } from 'react';
import { Table, RefreshCw, FileText, Lock, ShieldCheck } from 'lucide-react';
import { audio } from '../../utils/audio';

interface BossModeSpreadsheetProps {
  onExit: () => void;
}

export const BossModeSpreadsheet: React.FC<BossModeSpreadsheetProps> = ({ onExit }) => {
  const [selectedCell, setSelectedCell] = useState('B4');
  const [formulaVal, setFormulaVal] = useState('=SUM(C2:C15)*1.12');
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = () => {
    audio.playClick();
    setIsRecalculating(true);
    setTimeout(() => {
      setIsRecalculating(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white text-slate-800 font-sans flex flex-col select-none overflow-hidden" id="boss-mode-spreadsheet-overlay">
      {/* Excel Title Bar */}
      <div className="h-9 bg-[#107c41] text-white flex items-center justify-between px-3 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <FileText size={16} />
          <span>Q3_Financial_Projections_Audit_Report_2026.xlsx - Excel Corporate Edition</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRecalculate}
            className="flex items-center gap-1 bg-[#0b5c30] hover:bg-[#084524] px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
          >
            <RefreshCw size={11} className={isRecalculating ? "animate-spin" : ""} />
            Recalculate Formulas
          </button>
          <button
            onClick={() => { audio.playCoin(); onExit(); }}
            className="bg-rose-700 hover:bg-rose-800 px-2.5 py-0.5 rounded text-[11px] text-white font-bold cursor-pointer transition-colors"
            title="Sembunyikan Work Mode (Atau Tekan 'B')"
          >
            Esc Work Mode (B)
          </button>
        </div>
      </div>

      {/* Ribbon Bar */}
      <div className="bg-[#f3f2f1] border-b border-slate-300 px-4 py-2 flex items-center gap-6 text-xs text-slate-700">
        <span className="font-bold text-[#107c41] underline underline-offset-4 cursor-pointer">Home</span>
        <span className="hover:text-slate-900 cursor-pointer">Insert</span>
        <span className="hover:text-slate-900 cursor-pointer">Page Layout</span>
        <span className="hover:text-slate-900 cursor-pointer">Formulas</span>
        <span className="hover:text-slate-900 cursor-pointer">Data</span>
        <span className="hover:text-slate-900 cursor-pointer">Review</span>
        <span className="hover:text-slate-900 cursor-pointer">View</span>
        <div className="ml-auto text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-[#107c41]" />
          <span>Encrypted Local Session</span>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="bg-white border-b border-slate-300 px-3 py-1.5 flex items-center gap-2 text-xs">
        <div className="w-10 bg-slate-100 border border-slate-300 text-center font-mono py-0.5 text-slate-600 font-bold">
          {selectedCell}
        </div>
        <div className="text-slate-400 font-serif italic">fx</div>
        <input 
          type="text" 
          value={formulaVal}
          onChange={(e) => setFormulaVal(e.target.value)}
          className="flex-1 border border-slate-300 px-2 py-0.5 font-mono text-xs focus:outline-none focus:border-[#107c41]"
        />
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-auto bg-slate-50 font-mono text-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-200 text-slate-600 font-bold">
              <th className="border border-slate-300 w-10 text-center">#</th>
              <th className="border border-slate-300 px-3 py-1 text-left w-32">A (Dept)</th>
              <th className="border border-slate-300 px-3 py-1 text-right w-32">B (Revenue)</th>
              <th className="border border-slate-300 px-3 py-1 text-right w-32">C (OPEX)</th>
              <th className="border border-slate-300 px-3 py-1 text-right w-32">D (EBITDA)</th>
              <th className="border border-slate-300 px-3 py-1 text-center w-28">E (Status)</th>
              <th className="border border-slate-300 px-3 py-1 text-left">F (Notes)</th>
            </tr>
          </thead>
          <tbody>
            {[
              { row: 1, dept: 'Cloud Infrastructure', rev: '$245,000', opex: '$112,400', ebitda: '$132,600', status: 'APPROVED', notes: 'Optimized via containerization' },
              { row: 2, dept: 'Frontend Platform', rev: '$180,500', opex: '$84,000', ebitda: '$96,500', status: 'APPROVED', notes: 'Lazy exotic code splitting verified' },
              { row: 3, dept: 'Quality Assurance', rev: '$95,000', opex: '$41,200', ebitda: '$53,800', status: 'PENDING', notes: 'Awaiting end-to-end regression tests' },
              { row: 4, dept: 'Security Audit', rev: '$310,000', opex: '$140,000', ebitda: '$170,000', status: 'AUDITED', notes: 'Score checksum salt verified' },
              { row: 5, dept: 'Mobile Engineering', rev: '$215,000', opex: '$98,500', ebitda: '$116,500', status: 'APPROVED', notes: 'Touch events prevent scroll behavior' },
              { row: 6, dept: 'Data Science & AI', rev: '$420,000', opex: '$210,000', ebitda: '$210,000', status: 'APPROVED', notes: 'Realtime telemetry active' },
              { row: 7, dept: 'UI/UX Design Systems', rev: '$160,000', opex: '$65,000', ebitda: '$95,000', status: 'APPROVED', notes: 'Reduced motion accessibility enabled' },
            ].map((r) => (
              <tr 
                key={r.row} 
                onClick={() => setSelectedCell(`B${r.row + 1}`)}
                className={`hover:bg-emerald-50/80 cursor-pointer ${selectedCell === `B${r.row + 1}` ? 'bg-emerald-100/60 font-semibold' : 'bg-white'}`}
              >
                <td className="border border-slate-300 text-center bg-slate-100 text-slate-500">{r.row}</td>
                <td className="border border-slate-300 px-3 py-1">{r.dept}</td>
                <td className="border border-slate-300 px-3 py-1 text-right font-mono text-emerald-700">{r.rev}</td>
                <td className="border border-slate-300 px-3 py-1 text-right font-mono text-rose-600">{r.opex}</td>
                <td className="border border-slate-300 px-3 py-1 text-right font-mono font-bold text-slate-900">{r.ebitda}</td>
                <td className="border border-slate-300 px-3 py-1 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="border border-slate-300 px-3 py-1 text-slate-500 font-sans italic">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Sheet Tabs */}
      <div className="bg-slate-200 border-t border-slate-300 px-2 py-1 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <span className="bg-white px-3 py-1 border-t-2 border-t-[#107c41] font-bold text-[#107c41] rounded-t">Summary_2026</span>
          <span className="px-3 py-1 hover:bg-slate-300 rounded-t cursor-pointer">Raw_Data</span>
          <span className="px-3 py-1 hover:bg-slate-300 rounded-t cursor-pointer">Charts</span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Ready | 100% Zoom | Press 'B' key again to return to Game
        </div>
      </div>
    </div>
  );
};
