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
  category: 'missa' | 'reuniao' | 'formacao';
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
  "Ana Luiza Werneck", "Ana Luiza Souza", "Gabriel Garcia", "Ana Carla", "Gabriela"
];

const formatDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  // Month is 0-indexed in Date constructor
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', options);
};

export default function App() {
  const [acolytes, setAcolytes] = useState<Acolyte[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAcolyte, setSelectedAcolyte] = useState<Acolyte | null>(null);
  const [isAddingAbsence, setIsAddingAbsence] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [newAbsenceDate, setNewAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAbsenceType, setNewAbsenceType] = useState<'justified' | 'unjustified'>('unjustified');
  const [newAbsenceCategory, setNewAbsenceCategory] = useState<'missa' | 'reuniao' | 'formacao'>('missa');
  const [filterCategory, setFilterCategory] = useState<'all' | 'missa' | 'reuniao' | 'formacao'>('all');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to server');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'INIT' || type === 'STATE_UPDATE') {
        setAcolytes(data);
        
        // Update selected acolyte if open
        if (selectedAcolyte) {
          const updated = data.find((a: Acolyte) => a.id === selectedAcolyte.id);
          if (updated) setSelectedAcolyte(updated);
        }
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        setSocket(null);
      }, 3000);
    };

    setSocket(ws);

    return () => ws.close();
  }, [selectedAcolyte?.id]); // Re-run if selected ID changes to ensure state update logic works

  // PWA Install logic
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
    const newAbsence = {
      id: Math.random().toString(36).substr(2, 9),
      date: newAbsenceDate,
      type: newAbsenceType,
      category: newAbsenceCategory
    };

    if (socket && isConnected) {
      socket.send(JSON.stringify({
        type: 'ADD_ABSENCE',
        payload: { acolyteId, absence: newAbsence }
      }));
    }

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
        
        // Basic validation
        if (Array.isArray(importedData) && importedData.every(a => a.name && Array.isArray(a.absences))) {
          if (socket && isConnected) {
            socket.send(JSON.stringify({
              type: 'IMPORT_DATA',
              payload: importedData
            }));
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
    // Reset input
    event.target.value = '';
  };

  const shareApp = async () => {
    setShowAccessModal(true);
  };

  const copySharedLink = async () => {
    const sharedUrl = 'https://ais-pre-oms3vz7w3tmygdsvctque3-35791651476.us-east1.run.app';
    try {
      await navigator.clipboard.writeText(sharedUrl);
      alert('Link do aplicativo copiado para a área de transferência!');
    } catch (err) {
      alert('Erro ao copiar link. Por favor, copie manualmente.');
    }
  };

  const printReport = () => {
    window.print();
  };

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
                <button 
                  onClick={exportData}
                  title="Exportar Dados"
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <Download size={18} className="sm:w-5 sm:h-5" />
                </button>
                <label className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer">
                  <Upload size={18} className="sm:w-5 sm:h-5" />
                  <input type="file" accept=".json" className="hidden" onChange={importData} />
                </label>
                <button 
                  onClick={shareApp}
                  title="Compartilhar Link"
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <Share2 size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button 
                  onClick={printReport}
                  title="Imprimir Relatório"
                  className="hidden sm:block p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <Printer size={20} />
                </button>
              </div>

              <div className="bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <div className="flex flex-col sm:flex-row sm:gap-3">
                  <span className="text-indigo-700 font-semibold text-[10px] sm:text-xs">
                    {acolytes.reduce((acc, curr) => acc + curr.absences.filter(a => a.category === 'missa').length, 0)} Missas
                  </span>
                  <span className="text-indigo-700 font-semibold text-[10px] sm:text-xs">
                    {acolytes.reduce((acc, curr) => acc + curr.absences.filter(a => a.category === 'reuniao').length, 0)} Reuniões
                  </span>
                  <span className="text-indigo-700 font-semibold text-[10px] sm:text-xs">
                    {acolytes.reduce((acc, curr) => acc + curr.absences.filter(a => a.category === 'formacao').length, 0)} Formações
                  </span>
                </div>
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
              {(['all', 'missa', 'reuniao', 'formacao'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    filterCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat === 'missa' ? 'Missas' : cat === 'reuniao' ? 'Reuniões' : 'Formações'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        {/* Access / Share Modal */}
        <AnimatePresence>
          {showAccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <Smartphone size={20} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">Acesso Mobile & PC</h3>
                    </div>
                    <button 
                      onClick={() => setShowAccessModal(false)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-all"
                    >
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                        <QRCodeSVG 
                          value="https://ais-pre-oms3vz7w3tmygdsvctque3-35791651476.us-east1.run.app" 
                          size={180}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <p className="text-sm text-slate-500 text-center">
                        Escaneie o QR Code com a câmera do seu celular para abrir o aplicativo instantaneamente.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">Link Direto</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value="https://ais-pre-oms3vz7w3tmygdsvctque3-35791651476.us-east1.run.app"
                          className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-xl text-xs text-slate-600 outline-none"
                        />
                        <button 
                          onClick={copySharedLink}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex gap-3">
                        <div className="text-amber-600 shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          <strong>Dica:</strong> No celular, você pode adicionar este site à sua tela inicial para usá-lo como um aplicativo real!
                        </p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowAccessModal(false)}
                    className="w-full mt-6 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      acolyte.absences.length > 3 ? 'bg-red-100 text-red-600' : 
                      acolyte.absences.length > 0 ? 'bg-amber-100 text-amber-600' : 
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {acolyte.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {acolyte.absences.length === 0 ? 'Nenhuma falta' : 
                         `${acolyte.absences.length} faltas (${acolyte.absences.filter(a => a.category === 'missa').length}M / ${acolyte.absences.filter(a => a.category === 'reuniao').length}R / ${acolyte.absences.filter(a => a.category === 'formacao').length}F)`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 transition-all" />
                </div>

                {/* Progress Bar Mini */}
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min(
                        (filterCategory === 'all' 
                          ? acolyte.absences.length 
                          : acolyte.absences.filter(a => a.category === filterCategory).length
                        ) * 20, 100
                      )}%` 
                    }}
                    className={`h-full ${
                      (filterCategory === 'all' ? acolyte.absences.length : acolyte.absences.filter(a => a.category === filterCategory).length) > 3 ? 'bg-red-500' : 
                      (filterCategory === 'all' ? acolyte.absences.length : acolyte.absences.filter(a => a.category === filterCategory).length) > 0 ? 'bg-amber-500' : 
                      'bg-emerald-500'
                    }`}
                  />
                </div>

                {/* Print Only Absence List */}
                <div className="print-only mt-4 space-y-1">
                  {acolyte.absences.map(abs => (
                    <div key={abs.id} className="text-xs border-b border-slate-100 py-1 flex justify-between">
                      <span>{formatDate(abs.date)} ({abs.category === 'missa' ? 'M' : abs.category === 'reuniao' ? 'R' : 'F'})</span>
                      <span className="font-bold">{abs.type === 'justified' ? 'Justificada' : 'Não Justificada'}</span>
                    </div>
                  ))}
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
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedAcolyte(null);
                setIsAddingAbsence(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-slate-900">{selectedAcolyte.name}</h2>
                    <p className="text-sm text-slate-500">Histórico de Faltas</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAcolyte(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Registros</h3>
                  <button 
                    onClick={() => setIsAddingAbsence(true)}
                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                    Nova Falta
                  </button>
                </div>

                {isAddingAbsence && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200"
                  >
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Data da Falta</label>
                        <input 
                          type="date" 
                          value={newAbsenceDate}
                          onChange={(e) => setNewAbsenceDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                        <div className="flex gap-2">
                          {(['missa', 'reuniao', 'formacao'] as const).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setNewAbsenceCategory(cat)}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                newAbsenceCategory === cat
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white text-slate-500 border border-slate-200'
                              }`}
                            >
                              {cat === 'missa' ? 'Missa' : cat === 'reuniao' ? 'Reunião' : 'Formação'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Falta</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setNewAbsenceType('unjustified')}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                              newAbsenceType === 'unjustified' 
                                ? 'bg-red-600 text-white shadow-md' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Não Justificada
                          </button>
                          <button 
                            onClick={() => setNewAbsenceType('justified')}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                              newAbsenceType === 'justified' 
                                ? 'bg-emerald-600 text-white shadow-md' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Justificada
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => addAbsence(selectedAcolyte.id)}
                          className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                        >
                          Registrar Falta
                        </button>
                        <button 
                          onClick={() => setIsAddingAbsence(false)}
                          className="px-4 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-3">
                  {selectedAcolyte.absences.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <p className="text-slate-500 font-medium">Nenhuma falta registrada!</p>
                      <p className="text-slate-400 text-sm">Este acólito está com 100% de presença.</p>
                    </div>
                  ) : (
                    selectedAcolyte.absences.map((absence) => (
                      <div 
                        key={absence.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            absence.type === 'justified' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                          }`}>
                            <Calendar size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">
                              {formatDate(absence.date, {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              absence.type === 'justified' ? 'text-emerald-500' : 'text-red-500'
                            }`}>
                              {absence.category === 'missa' ? 'Missa' : absence.category === 'reuniao' ? 'Reunião' : 'Formação'} • {absence.type === 'justified' ? 'Justificada' : 'Não Justificada'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeAbsence(selectedAcolyte.id, absence.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                  <AlertCircle size={18} />
                  <p className="text-xs font-medium">
                    Lembre-se de conversar com o acólito caso as faltas excedam o limite permitido.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty State when searching */}
      {filteredAcolytes.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={40} />
          </div>
          <h3 className="text-lg font-semibold text-slate-600">Nenhum acólito encontrado</h3>
          <p className="text-slate-400">Tente buscar por outro nome.</p>
        </div>
      )}

      {/* Install Guide Modal */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallGuide(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative z-10 p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Smartphone size={32} />
                </div>
                <h2 className="text-xl font-display font-bold text-slate-900">Como Baixar o App</h2>
                <p className="text-sm text-slate-500 mt-2">Siga os passos abaixo para instalar no seu celular:</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm mb-1">No Android (Chrome):</h3>
                  <p className="text-xs text-slate-600">Toque nos 3 pontinhos no topo e escolha <span className="font-bold">"Instalar aplicativo"</span>.</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm mb-1">No iPhone (Safari):</h3>
                  <p className="text-xs text-slate-600">Toque no botão de <span className="font-bold">Compartilhar</span> (quadrado com seta) e escolha <span className="font-bold">"Adicionar à Tela de Início"</span>.</p>
                </div>
              </div>

              <button 
                onClick={() => setShowInstallGuide(false)}
                className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
