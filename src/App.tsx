/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import * as XLSX from 'xlsx';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Download, 
  Edit2, 
  X, 
  Check, 
  Flower2, 
  Sprout,
  Loader2,
  ScanLine
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type ItemType = 'PIANTA' | 'MAZZO';

interface InventoryItem {
  id: string;
  type: ItemType;
  article: string;
  quantity: number;
  price: number;
  // Specific fields
  potDiameter?: string; // for PIANTA
  stemsCount?: number;  // for MAZZO
  timestamp: number;
}

// Gemini Setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    type: 'PIANTA',
    article: '',
    quantity: 1,
    price: 0,
    potDiameter: '',
    stemsCount: 0
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Totals
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Camera handling
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Impossibile accedere alla fotocamera. Controlla i permessi.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsScanning(false);
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsScanningAI(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analizza questa etichetta di una pianta o di un fiore. Estrai solo il nome dell'articolo (es. 'Orchidea Phalaenopsis', 'Rosa Rossa', ecc.). Rispondi solo con il nome dell'articolo, niente altro." },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ]
      });

      const articleName = response.text?.trim() || "";
      if (articleName) {
        setFormData(prev => ({ ...prev, article: articleName }));
        stopCamera();
      }
    } catch (err) {
      console.error("AI Scan error:", err);
      alert("Errore durante la scansione AI. Riprova.");
    } finally {
      setIsScanningAI(false);
    }
  };

  // Inventory logic
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.article) return;

    const newItem: InventoryItem = {
      id: editingItem?.id || crypto.randomUUID(),
      type: formData.type as ItemType,
      article: formData.article,
      quantity: Number(formData.quantity),
      price: Number(formData.price),
      potDiameter: formData.type === 'PIANTA' ? formData.potDiameter : undefined,
      stemsCount: formData.type === 'MAZZO' ? Number(formData.stemsCount) : undefined,
      timestamp: Date.now()
    };

    if (editingItem) {
      setItems(prev => prev.map(item => item.id === editingItem.id ? newItem : item));
      setEditingItem(null);
    } else {
      setItems(prev => [newItem, ...prev]);
    }

    setFormData({
      type: 'PIANTA',
      article: '',
      quantity: 1,
      price: 0,
      potDiameter: '',
      stemsCount: 0
    });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo articolo?")) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const exportToExcel = () => {
    const data = items.map(item => ({
      Tipo: item.type,
      Articolo: item.article,
      Quantità: item.quantity,
      Prezzo: item.price,
      'Diametro Vaso (cm)': item.potDiameter || '-',
      'Numero Steli': item.stemsCount || '-',
      Totale: item.price * item.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_Flora_${new Date().toLocaleDateString()}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-serif italic tracking-tight text-emerald-900">Flora Inventory</h1>
            <p className="text-stone-500 text-sm uppercase tracking-widest mt-1">Gestione Magazzino Negozio</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setEditingItem(null);
                setFormData({ type: 'PIANTA', article: '', quantity: 1, price: 0, potDiameter: '', stemsCount: 0 });
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-emerald-800 text-white px-6 py-3 rounded-full hover:bg-emerald-900 transition-all shadow-md active:scale-95"
            >
              <Plus size={20} />
              <span>Nuovo Articolo</span>
            </button>
            
            <button 
              onClick={exportToExcel}
              disabled={items.length === 0}
              className="flex items-center gap-2 border border-stone-300 bg-white px-6 py-3 rounded-full hover:bg-stone-100 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              <span>Esporta Excel</span>
            </button>
          </div>
        </header>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <p className="text-stone-400 text-xs uppercase tracking-widest mb-1">Valore Totale</p>
            <p className="text-3xl font-light">€ {totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <p className="text-stone-400 text-xs uppercase tracking-widest mb-1">Articoli Totali</p>
            <p className="text-3xl font-light">{totalItems}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <p className="text-stone-400 text-xs uppercase tracking-widest mb-1">Voci Inventario</p>
            <p className="text-3xl font-light">{items.length}</p>
          </div>
        </div>

        {/* Main Content */}
        <main className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
          {items.length === 0 && !showForm ? (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-stone-100 rounded-full mb-4">
                <Flower2 className="text-stone-300" size={40} />
              </div>
              <h3 className="text-xl font-medium text-stone-600">L'inventario è vuoto</h3>
              <p className="text-stone-400 mt-2">Inizia aggiungendo il tuo primo articolo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-bottom border-stone-200">
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Tipo</th>
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Articolo</th>
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest">Dettaglio</th>
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest text-center">Quantità</th>
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest text-right">Prezzo</th>
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest text-right">Totale</th>
                    <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-widest text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  <AnimatePresence mode='popLayout'>
                    {items.map((item) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="hover:bg-stone-50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          {item.type === 'PIANTA' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                              <Sprout size={14} /> Pianta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium">
                              <Flower2 size={14} /> Mazzo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-stone-800">{item.article}</td>
                        <td className="px-6 py-4 text-sm text-stone-500 italic">
                          {item.type === 'PIANTA' ? `Ø ${item.potDiameter} cm` : `${item.stemsCount} steli`}
                        </td>
                        <td className="px-6 py-4 text-center font-mono">{item.quantity}</td>
                        <td className="px-6 py-4 text-right font-mono text-stone-600">€ {item.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-800">
                          € {(item.price * item.quantity).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEdit(item)}
                              className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all"
                              title="Modifica"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                              title="Elimina"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isScanning && setShowForm(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif italic text-emerald-900">
                    {editingItem ? 'Modifica Articolo' : 'Nuovo Articolo'}
                  </h2>
                  <button 
                    onClick={() => setShowForm(false)}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                  {/* Type Selector */}
                  <div className="flex p-1 bg-stone-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: 'PIANTA' }))}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-medium text-sm",
                        formData.type === 'PIANTA' ? "bg-white text-emerald-800 shadow-sm" : "text-stone-500"
                      )}
                    >
                      <Sprout size={18} /> Pianta
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: 'MAZZO' }))}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-medium text-sm",
                        formData.type === 'MAZZO' ? "bg-white text-rose-800 shadow-sm" : "text-stone-500"
                      )}
                    >
                      <Flower2 size={18} /> Mazzo
                    </button>
                  </div>

                  {/* Article Name with Scan Button */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Nome Articolo</label>
                    <div className="relative">
                      <input 
                        type="text"
                        required
                        value={formData.article}
                        onChange={e => setFormData(prev => ({ ...prev, article: e.target.value }))}
                        placeholder="Es. Orchidea, Rose Rosse..."
                        className="w-full pl-4 pr-12 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                      />
                      <button 
                        type="button"
                        onClick={startCamera}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Scansiona Etichetta"
                      >
                        <Camera size={24} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Specific Field */}
                    {formData.type === 'PIANTA' ? (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Ø Vaso (cm)</label>
                        <input 
                          type="text"
                          value={formData.potDiameter}
                          onChange={e => setFormData(prev => ({ ...prev, potDiameter: e.target.value }))}
                          placeholder="Es. 12"
                          className="w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest">N. Steli</label>
                        <input 
                          type="number"
                          value={formData.stemsCount}
                          onChange={e => setFormData(prev => ({ ...prev, stemsCount: Number(e.target.value) }))}
                          className="w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>
                    )}

                    {/* Quantity */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Quantità</label>
                      <input 
                        type="number"
                        min="1"
                        required
                        value={formData.quantity}
                        onChange={e => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        className="w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Prezzo Unitario (€)</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={e => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="w-full px-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-5 bg-emerald-800 text-white rounded-2xl font-semibold text-lg hover:bg-emerald-900 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Check size={24} />
                    <span>{editingItem ? 'Aggiorna Inventario' : 'Aggiungi all\'Inventario'}</span>
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera Overlay */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col">
            <div className="relative flex-1">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              {/* Scan Frame UI */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-white/50 rounded-2xl relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                  
                  {isScanningAI && (
                    <motion.div 
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"
                    />
                  )}
                </div>
              </div>

              <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
                <p className="text-white text-sm font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full">
                  Inquadra l'etichetta dell'articolo
                </p>
                <button 
                  onClick={stopCamera}
                  className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="bg-stone-900 p-8 flex justify-center items-center gap-8">
              <button 
                onClick={captureAndScan}
                disabled={isScanningAI}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
              >
                {isScanningAI ? (
                  <Loader2 className="animate-spin text-emerald-600" size={32} />
                ) : (
                  <div className="w-16 h-16 border-4 border-stone-200 rounded-full flex items-center justify-center">
                    <ScanLine className="text-stone-900" size={28} />
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
