/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Calendar, 
  Plus, 
  Trash2, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2,
  Users,
  Search,
  X,
  Download,
  Upload,
  Share2,
  Printer,
  Smartphone,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Absence {
  id: string;
  date: string;
  type: 'justified' | 'unjustified';
  category: 'missa' | 'reuniao';
  reason?: string;
}

interface Acolyte {
  id: string;
  name: string;
  absences: Absence[];
}

const INITIAL_NAMES = [
  "Lincoln", "Maria Clara Duque", "Miguel Melo", "Rodrigo", "Lilian", 
  "Gabriel luiz", "Jhemilly", "Maria Livia", "Lucas", "Maria Clara Iung", 
  "Maria luiza", "Matheus", "Nathan", "Sarah", "Sara", 
  "Ana Luiza Werneck", "Ana Luiza Souza", "Gabriel Garcia", "Ana Carla", "Gabriela",
  "Mariana"
];

const formatDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', options);
};

const getAcolyteStatus = (absences: Absence[]) => {
  const unjustifiedAbsences = [...absences]
    .filter(a => a.type === 'unjustified')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const justifiedAbsences = [...absences]
    .filter(a => a.type === 'justified')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const activeWarnings: { label: string, color: string, type: string, expiresIn?: number }[] = [];
  const now = new Date();

  if (unjustifiedAbsences.length >= 3) {
    activeWarnings.push({ label: 'Adv. Verbal (S/J)', color: 'bg-amber-500 text-white', type: 'verbal' });
  }
  if (unjustifiedAbsences.length >= 5) {
    activeWarnings.push({ label: 'Adv. Escrita (S/J)', color: 'bg-orange-500 text-white', type: 'written' });
  }
  if (unjustifiedAbsences.length >= 6) {
    const triggerDate = new Date(unjustifiedAbsences[5].date);
    const diffTime = now.getTime() - triggerDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays < 30) {
      activeWarnings.push({ 
        label: 'Suspensão', 
        color: 'bg-red-600 text-white', 
        type: 'suspension',
        expiresIn: Math.ceil(30 - diffDays)
      });
    }
  }

  if (justifiedAbsences.length >= 5) {
    activeWarnings.push({ label: 'Adv. Verbal (C/J)', color: 'bg-emerald-500 text-white', type: 'verbal_justified' });
  }

  return {
    warnings: activeWarnings,
    unjustified: unjustifiedAbsences.length,
    justified: justifiedAbsences.length,
    mainColor: activeWarnings.some(w => w.type === 'suspension') ? 'bg-red-100 text-red-600' :
               activeWarnings.some(w => w.type === 'written') ? 'bg-orange-100 text-orange-600' :
               activeWarnings.some(w => w.type === 'verbal' || w.type === 'verbal_justified') ? 'bg-amber-100 text-amber-600' :
               'bg-emerald-100 text-emerald-600',
    barColor: activeWarnings.some(w => w.type === 'suspension') ? 'bg-red-600' :
              activeWarnings.some(w => w.type === 'written') ? 'bg-orange-50' :
              activeWarnings.some(w => w.type === 'verbal' || w.type === 'verbal_justified') ? 'bg-amber-500' :
              'bg-emerald-500'
  };
};

export default function App() {
  const [acolytes, setAcolytes] = useState<Acolyte[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAcolyte, setSelectedAcolyte] = useState<Acolyte | null>(null);
  const [isAddingAbsence, setIsAddingAbsence] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [newAbsenceDate, setNewAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAbsenceType, setNewAbsenceType] = useState<'justified' | 'unjustified'>('unjustified');
  const [newAbsenceCategory, setNewAbsenceCategory] = useState<'missa' | 'reuniao'>('missa');
  const [filterCategory, setFilterCategory] = useState<'all' | 'missa' | 'reuniao'>('all');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const { type, data } = JSON.parse(event.data);
        if (type === 'INIT' || type === 'STATE_UPDATE') {
          setAcolytes(data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      setSocket(ws);
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  useEffect(() => {
    if (selectedAcolyte) {
      const updated = acolytes.find(a => a.id === selectedAcolyte.id);
      if (updated) setSelectedAcolyte(updated);
    }
  }, [acolytes]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  const addAbsence = (acolyteId: string) => {
    if (!socket || !isConnected) {
      alert('Sem conexão com o servidor. Por favor, aguarde a bolinha verde piscar no topo.');
      return;
    }

    const newAbsence = {
      id: Math.random().toString(36).substr(2, 9),
      date: newAbsenceDate,
      type: newAbsenceType,
      category: newAbsenceCategory
    };

    socket.send(JSON.stringify({
      type: 'ADD_ABSENCE',
      payload: { acolyteId, absence: newAbsence }
    }));

    setIsAddingAbsence(false);
    setNewAbsenceType('unjustified');
    setNewAbsenceCategory('missa');
  };

  const removeAbsence = (acolyteId: string, absenceId: string) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({
        type: 'REMOVE_ABSENCE',
        payload: { absenceId }
      }));
    }
  };

  const filteredAcolytes = acolytes.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterCategory === 'all') return matchesSearch;
    return matchesSearch && a.absences.some(abs => abs.category === filterCategory);
  }).sort((a, b) => {
    if (filterCategory === 'all') return b.absences.length - a.absences.length;
    const countA = a.absences.filter(abs => abs.category === filterCategory).length;
    const countB = b.absences.filter(abs => abs.category === filterCategory).length;
    return countB - countA;
  });

  const totalAbsences = acolytes.reduce((acc, curr) => acc + curr.absences.length, 0);

  const exportData = () => {
    const dataStr = JSON.stringify(acolytes, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `acolitos_faltas_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        if (Array.isArray(importedData) && importedData.every(a => a.name && Array.isArray(a.absences))) {
          if (socket && isConnected) {
            socket.send(JSON.stringify({ type: 'IMPORT_DATA', payload: importedData }));
          }
          alert('Dados importados com sucesso!');
        } else {
          alert('Formato de arquivo inválido.');
        }
      } catch (err) {
        alert('Erro ao ler o arquivo.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const shareApp = () => setShowAccessModal(true);

  const copySharedLink = async () => {
    const sharedUrl = window.location.origin;
    try {
      await navigator.clipboard.writeText(sharedUrl);
      alert('Link do aplicativo copiado para a área de transferência!');
    } catch (err) {
      alert('Erro ao copiar link. Por favor, copie manualmente.');
    }
  };

  const printReport = () => window.print();

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Print Header */}
      <div className="print-only p-8 border-b-2 border-slate-900 mb-8">
        <h1 className="text-3xl font-bold">Relatório de Faltas - Pastoral de Acólitos</h1>
        <p className="text-slate-600">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
        <p className="text-slate-600">Total de Faltas: {totalAbsences}</p>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
                <Users className="text-indigo-600" />
                Pastoral de Acólitos
              </h1>
              <p className="text-slate-500 text-sm">Controle de Faltas e Presenças</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-xl font-bold text-xs sm:text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <Smartphone size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Baixar App</span>
                <span className="xs:hidden">Baixar</span>
              </button>

              <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={exportData} title="Exportar Dados" className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <Download size={18} className="sm:w-5 sm:h-5" />
                </button>
                <label className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer">
                  <Upload size={18} className="sm:w-5 sm:h-5" />
                  <input type="file" accept=".json" className="hidden" onChange={importData} />
                </label>
                <button onClick={shareApp} title="Compartilhar Link" className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <Share2 size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button onClick={printReport} title="Imprimir Relatório" className="hidden sm:block p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <Printer size={20} />
                </button>
              </div>

              <div className="bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar acólito..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {(['all', 'missa', 'reuniao'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    filterCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat === 'missa' ? 'Missas' : 'Reuniões'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        {/* Access Modal */}
        <AnimatePresence>
          {showAccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Smartphone size={20} /></div>
                      <h3 className="text-xl font-bold text-slate-800">Acesso Mobile & PC</h3>
                    </div>
                    <button onClick={() => setShowAccessModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X size={20} className="text-slate-400" /></button>
                  </div>
                  <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                        <QRCodeSVG value={window.location.origin} size={180} level="H" includeMargin={true} />
                      </div>
                      <p className="text-sm text-slate-500 text-center">Escaneie o QR Code para abrir o app no celular.</p>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">Link Direto</label>
                      <div className="flex gap-2">
                        <input type="text" readOnly value={window.location.origin} className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-xl text-xs text-slate-600 outline-none" />
                        <button onClick={copySharedLink} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">Copiar</button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowAccessModal(false)} className="w-full mt-6 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all">Fechar</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Rules Summary */}
        <div className="mb-8">
          <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3">Regras de Advertência</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px]">
                <div className="space-y-1">
                  <p className="font-bold text-indigo-200 uppercase">Sem Justificativa:</p>
                  <ul className="space-y-0.5 opacity-90">
                    <li>• 3 faltas: Advertência Verbal</li>
                    <li>• 5 faltas: Advertência por Escrito</li>
                    <li>• 6 faltas: Suspensão (30 dias)</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-indigo-200 uppercase">Com Justificativa:</p>
                  <ul className="space-y-0.5 opacity-90">
                    <li>• 5 faltas: Advertência Verbal</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10"><AlertCircle size={120} /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAcolytes.map((acolyte) => (
              <motion.div
                layout
                key={acolyte.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedAcolyte(acolyte)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 flex flex-col items-end">
                  {getAcolyteStatus(acolyte.absences).warnings.length === 0 ? (
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-bl-xl text-[9px] font-black uppercase tracking-wider">Regular</div>
                  ) : (
                    getAcolyteStatus(acolyte.absences).warnings.map((w, idx) => (
                      <div key={idx} className={`px-3 py-1 ${w.color} ${idx === 0 ? 'rounded-bl-xl' : ''} text-[9px] font-black uppercase tracking-wider shadow-sm`}>{w.label}</div>
                    ))
                  )}
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getAcolyteStatus(acolyte.absences).mainColor}`}><User size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{acolyte.name}</h3>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-medium text-slate-400 uppercase">{acolyte.absences.length} faltas no total</p>
                        {acolyte.absences.length > 0 && (
                          <div className="flex gap-2 text-[10px]">
                            <span className="text-red-500 font-bold">{getAcolyteStatus(acolyte.absences).unjustified} Sem Just.</span>
                            <span className="text-emerald-600 font-bold">{getAcolyteStatus(acolyte.absences).justified} Com Just.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((getAcolyteStatus(acolyte.absences).unjustified * 16.6) + (getAcolyteStatus(acolyte.absences).justified * 10), 100)}%` }}
                    className={`h-full ${getAcolyteStatus(acolyte.absences).barColor}`}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAcolyte && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setSelectedAcolyte(null); setIsAddingAbsence(false); }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100"><User size={24} /></div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 leading-tight">{selectedAcolyte.name}</h2>
                    <div className="flex gap-2 mt-1.5">
                      <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter block">Total</span>
                        <span className="text-sm font-black text-indigo-600 leading-none">{selectedAcolyte.absences.length}</span>
                      </div>
                      <div className="bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                        <span className="text-[8px] font-black text-red-400 uppercase tracking-tighter block">S/ Just.</span>
                        <span className="text-sm font-black text-red-600 leading-none">{getAcolyteStatus(selectedAcolyte.absences).unjustified}</span>
                      </div>
                      <div className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter block">C/ Just.</span>
                        <span className="text-sm font-black text-emerald-600 leading-none">{getAcolyteStatus(selectedAcolyte.absences).justified}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedAcolyte(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Warnings Summary */}
                <div className="space-y-3 mb-8">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Situação e Advertências</h3>
                  {getAcolyteStatus(selectedAcolyte.absences).warnings.length === 0 ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-emerald-50 border-emerald-100 text-emerald-700">
                      <CheckCircle2 size={20} className="shrink-0" />
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Situação Atual</p>
                        <p className="text-xs font-bold leading-none">Frequência em dia.</p>
                      </div>
                    </div>
                  ) : (
                    getAcolyteStatus(selectedAcolyte.absences).warnings.map((w, idx) => (
                      <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${w.type === 'suspension' ? 'bg-red-50 border-red-100 text-red-900' : w.type === 'written' ? 'bg-orange-50 border-orange-100 text-orange-900' : 'bg-amber-50 border-amber-100 text-amber-900'}`}>
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">{w.type === 'suspension' ? '🚨 Suspensão Ativa' : w.type === 'written' ? '📄 Advertência por Escrito' : '🗣️ Advertência Verbal'}</p>
                          <p className="text-xs font-bold leading-none">
                            {w.type === 'suspension' ? `Suspenso por 30 dias. Faltam ${w.expiresIn} dias.` : w.type === 'written' ? 'Atingiu 5 faltas sem justificativa.' : w.type === 'verbal' ? 'Atingiu 3 faltas sem justificativa.' : 'Atingiu 5 faltas com justificativa.'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Registros de Faltas</h3>
                  <button onClick={() => setIsAddingAbsence(true)} className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={16} /> Nova Falta
                  </button>
                </div>

                {isAddingAbsence && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 bg-slate-50 rounded-2xl border border-indigo-100 shadow-inner">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data da Falta</label>
                        <input type="date" value={newAbsenceDate} onChange={(e) => setNewAbsenceDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Categoria</label>
                        <select value={newAbsenceCategory} onChange={(e) => setNewAbsenceCategory(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm">
                          <option value="missa">Missa</option>
                          <option value="reuniao">Reunião</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                        <select value={newAbsenceType} onChange={(e) => setNewAbsenceType(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm">
                          <option value="unjustified">Não Justificada</option>
                          <option value="justified">Justificada</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex gap-2 pt-1">
                        <button onClick={() => addAbsence(selectedAcolyte.id)} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">Registrar Falta</button>
                        <button onClick={() => setIsAddingAbsence(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-3">
                  {selectedAcolyte.absences.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-medium">Nenhuma falta registrada!</div>
                  ) : (
                    [...selectedAcolyte.absences].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((absence) => (
                      <div key={absence.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${absence.type === 'justified' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><Calendar size={16} /></div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700 text-xs">{formatDate(absence.date, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${absence.type === 'justified' ? 'text-emerald-500' : 'text-red-500'}`}>
                              {absence.category === 'missa' ? 'Missa' : 'Reunião'} • {absence.type === 'justified' ? 'Justificada' : 'Não Justificada'}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeAbsence(selectedAcolyte.id, absence.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredAcolytes.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4"><Search size={40} /></div>
          <h3 className="text-lg font-semibold text-slate-600">Nenhum acólito encontrado</h3>
          <p className="text-slate-400">Tente buscar por outro nome.</p>
        </div>
      )}

      {/* Install Guide */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInstallGuide(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative z-10 p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Smartphone size={32} /></div>
                <h2 className="text-xl font-display font-bold text-slate-900">Como Baixar o App</h2>
                <p className="text-sm text-slate-500 mt-2">Siga os passos abaixo:</p>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm mb-1">Android (Chrome):</h3>
                  <p className="text-xs text-slate-600">Toque nos 3 pontinhos e escolha <span className="font-bold">"Instalar aplicativo"</span>.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm mb-1">iPhone (Safari):</h3>
                  <p className="text-xs text-slate-600">Toque em <span className="font-bold">Compartilhar</span> e escolha <span className="font-bold">"Adicionar à Tela de Início"</span>.</p>
                </div>
              </div>
              <button onClick={() => setShowInstallGuide(false)} className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Entendi</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
