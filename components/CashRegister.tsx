import React, { useState, useEffect } from 'react';
import { DataService } from '../services/db';
import { Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, Calendar, CreditCard, Banknote, Landmark, Filter, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';

const CashRegister: React.FC = () => {
    const { instituteId } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [filterDate, setFilterDate] = useState<string>('month'); // 'today', 'month', 'all'
    const [summary, setSummary] = useState({ total: 0, cash: 0, transfer: 0, card: 0, mp: 0 });

    useEffect(() => {
        loadTransactions();
    }, [instituteId, filterDate]);

    const loadTransactions = async () => {
        if (!instituteId) return;
        setLoading(true);
        try {
            const allTransactions = await DataService.getTransactions(instituteId);

            // Filter logic (Client side for now, could be DB side later)
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            let filtered = allTransactions;
            if (filterDate === 'today') {
                filtered = allTransactions.filter(t => t.date >= startOfDay);
            } else if (filterDate === 'month') {
                filtered = allTransactions.filter(t => t.date >= startOfMonth);
            }

            setTransactions(filtered);
            calculateSummary(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateSummary = (data: Transaction[]) => {
        let total = 0;
        let cash = 0;
        let transfer = 0;
        let card = 0;
        let mp = 0;

        data.forEach(t => {
            if (t.type === 'INCOME') {
                total += t.amount;
                if (t.method === 'CASH') cash += t.amount;
                else if (t.method === 'TRANSFER') transfer += t.amount;
                else if (t.method === 'CARD') card += t.amount;
                else if (t.method === 'MP') mp += t.amount;
            }
        });

        setSummary({ total, cash, transfer, card, mp });
    };

    const handleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            const count = await DataService.syncMissingTransactions(instituteId);
            if (count > 0) {
                alert(`¡Éxito! Se han recuperado ${count} pagos históricos a la caja.`);
                loadTransactions(); // Recargar datos
            } else {
                alert("Todo está en orden. No se encontraron pagos faltantes.");
            }
        } catch (error) {
            console.error("Sync error:", error);
            alert("Error al sincronizar. Revisa la consola.");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 border-b border-gray-100 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-serif font-bold text-gray-900">Caja y Movimientos</h2>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-brand-green transition-all ${syncing ? 'animate-spin text-brand-green' : ''}`}
                            title="Sincronizar pagos históricos faltantes"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                    <p className="text-gray-500 font-medium max-w-xl">Control de ingresos diarios y mensuales desglosados por método de pago.</p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setFilterDate('today')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterDate === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => setFilterDate('month')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterDate === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Este Mes
                    </button>
                    <button
                        onClick={() => setFilterDate('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterDate === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-brand-green to-[#1e3f2e] p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80} /></div>
                    <p className="text-brand-gold font-bold text-xs uppercase tracking-widest mb-1">Total Ingresos</p>
                    <h3 className="text-3xl font-serif font-bold">${summary.total.toLocaleString()}</h3>
                    <p className="text-white/60 text-xs mt-2 font-medium bg-white/10 inline-block px-2 py-1 rounded-lg">
                        {filterDate === 'today' ? 'Caja del Día' : filterDate === 'month' ? 'Acumulado Mensual' : 'Total Histórico'}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-green-100 text-green-700 rounded-xl flex items-center justify-center mb-3"><Banknote size={20} /></div>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">Efectivo</p>
                    <h3 className="text-2xl font-bold text-gray-900">${summary.cash.toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-3"><Landmark size={20} /></div>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">Transferencias</p>
                    <h3 className="text-2xl font-bold text-gray-900">${summary.transfer.toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center mb-3"><CreditCard size={20} /></div>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">Tarjetas / MP</p>
                    <h3 className="text-2xl font-bold text-gray-900">${(summary.card + summary.mp).toLocaleString()}</h3>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Filter size={18} className="text-gray-400" />
                        Últimos Movimientos
                    </h3>
                    <span className="text-xs font-bold text-gray-400 bg-white border border-gray-200 px-3 py-1 rounded-lg">
                        {transactions.length} registros
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-12 text-center text-gray-400">Cargando movimientos...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 italic">No hay movimientos registrados en este período.</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-widest bg-gray-50/30">
                                    <th className="px-6 py-4 font-bold">Fecha</th>
                                    <th className="px-6 py-4 font-bold">Alumno</th>
                                    <th className="px-6 py-4 font-bold">Concepto</th>
                                    <th className="px-6 py-4 font-bold">Método</th>
                                    <th className="px-6 py-4 font-bold text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                            {new Date(t.date).toLocaleDateString()} <span className="text-xs text-gray-300 ml-1">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-brand-green transition-colors">{t.studentName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 font-medium bg-gray-50/50 rounded-lg inline-block my-2 mx-6 w-fit px-3 py-1 uppercase text-xs tracking-wide">{t.concept}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border
                                          ${t.method === 'CASH' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    t.method === 'TRANSFER' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-purple-50 text-purple-700 border-purple-100'
                                                }
                                      `}>
                                                {t.method === 'MP' ? 'MERCADO PAGO' : t.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900 font-mono">
                                            + ${t.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CashRegister;
