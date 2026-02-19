import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from '../services/db';
import { Student, ACADEMIC_LEVELS, Level, MONTHS_AND_CONCEPTS, FeesDoc } from '../types';
import { ArrowLeft, TrendingDown, Users, AlertTriangle, ChevronRight, BarChart3, PieChart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart as RePieChart, Pie } from 'recharts';

const DebtorsReport: React.FC = () => {
    const { instituteId } = useAuth();
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>([]);
    const [fees, setFees] = useState<FeesDoc>({});
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>('enrolment');

    useEffect(() => {
        const load = async () => {
            if (instituteId) {
                const [data, feesData] = await Promise.all([
                    DataService.getStudents(instituteId),
                    DataService.getFees(instituteId)
                ]);
                setStudents(data);
                setFees(feesData);
                setLoading(false);
            }
        };
        load();
    }, [instituteId]);

    // Data Processing
    const processData = () => {
        let totalDebt = 0;
        let totalDebtors = 0;

        const levelData = ACADEMIC_LEVELS.map(level => {
            const levelStudents = students.filter(s => s.level === level);
            const totalStudents = levelStudents.length;

            let levelDebt = 0;
            let debtorsCount = 0;

            levelStudents.forEach(s => {
                // Check debt for selected month
                let isDebtor = false;
                let amount = 0;

                // Estimate amount (using a default if not set in DB, this is an estimation)
                // In a real scenario, we'd fetch fees configuration. 
                // For now, we assume a standard fee for visualization or check the payment record if it exists but is unpaid (rare).
                // Better approach: Count unpaid.

                // Get configured fee for this level
                const levelFees = fees[s.level] || { tuition: 0, enrolment: 0, test: 0 };

                if (selectedMonth === 'enrolment') {
                    const full = s.payments['enrolment']?.paid;
                    const part1 = s.payments['enrolment_1']?.paid;
                    if (!full && !part1) {
                        isDebtor = true;
                        amount = s.payments['enrolment']?.amount || levelFees.enrolment;
                    }
                } else if (selectedMonth === 'test') {
                    if (!s.payments['test']?.paid) {
                        isDebtor = true;
                        amount = s.payments['test']?.amount || levelFees.test;
                    }
                } else {
                    if (!s.payments[selectedMonth]?.paid) {
                        isDebtor = true;
                        amount = s.payments[selectedMonth]?.amount || levelFees.tuition;
                    }
                }

                if (isDebtor) {
                    debtorsCount++;
                    levelDebt += amount;
                }
            });

            totalDebt += levelDebt;
            totalDebtors += debtorsCount;

            const paidCount = totalStudents - debtorsCount;
            const collectionRate = totalStudents > 0 ? (paidCount / totalStudents) * 100 : 0;

            return {
                name: level,
                debt: levelDebt,
                debtors: debtorsCount,
                students: totalStudents,
                collectionRate: Math.round(collectionRate),
                paid: paidCount
            };
        });

        // Filter out levels with 0 students to clean up charts
        const activeLevelData = levelData.filter(d => d.students > 0);

        const totalActiveStudents = students.length;
        const globalCollectionRate = totalActiveStudents > 0 ? ((totalActiveStudents - totalDebtors) / totalActiveStudents) * 100 : 0;

        return { levelData: activeLevelData, totalDebt, totalDebtors, globalCollectionRate };
    };

    const stats = processData();

    // Sort for "Critical Levels" (Lowest collection rate)
    const criticalLevels = [...stats.levelData].sort((a, b) => a.collectionRate - b.collectionRate).slice(0, 3);

    // COLORS
    const COLORS = ['#1F4529', '#Eab308', '#ef4444', '#3b82f6'];

    if (loading) return <div className="p-8 flex justify-center text-gray-500">Cargando reporte...</div>;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-12 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-serif font-bold text-brand-green">Reporte de Morosidad</h1>
                            <p className="text-gray-500 text-sm">Análisis de deudas por nivel académico</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Período:</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent font-bold text-brand-green outline-none cursor-pointer"
                        >
                            {MONTHS_AND_CONCEPTS.map(m => (
                                <option key={m} value={m}>{m.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Deuda Estimada</p>
                            <h3 className="text-2xl font-bold text-gray-900">${stats.totalDebt.toLocaleString()}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Alumnos con Deuda</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.totalDebtors} <span className="text-sm font-normal text-gray-400">/ {students.length}</span></h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-brand-green rounded-xl">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">% Cobranza Global</p>
                            <h3 className={`text-2xl font-bold ${stats.globalCollectionRate < 80 ? 'text-orange-500' : 'text-brand-green'}`}>
                                {Math.round(stats.globalCollectionRate)}%
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Chart Section */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Bar Chart */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-orange-500" />
                                Deuda por Nivel
                            </h3>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.levelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                                        <Tooltip
                                            cursor={{ fill: '#f9fafb' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="debt" name="Deuda Estimada" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Breakdown List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-900">Detalle por Nivel</h3>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {stats.levelData.map(level => (
                                    <div key={level.name} className="p-6 hover:bg-gray-50 transition-colors group">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-10 bg-brand-green rounded-full"></div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{level.name}</h4>
                                                    <p className="text-xs text-gray-500">{level.students} alumnos total</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-red-600">${level.debt.toLocaleString()}</p>
                                                <p className="text-xs text-gray-500">{level.debtors} d. / {level.paid} p.</p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs font-semibold mb-1">
                                                <span className={level.collectionRate < 70 ? "text-red-500" : "text-brand-green"}>
                                                    {level.collectionRate}% Cobrado
                                                </span>
                                                <span className="text-gray-400">{100 - level.collectionRate}% Pendiente</span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${level.collectionRate < 70 ? 'bg-orange-400' : 'bg-brand-green'}`}
                                                    style={{ width: `${level.collectionRate}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Insights Side Panel */}
                    <div className="space-y-6">
                        {/* Critical Levels */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">Niveles Críticos</h3>
                            <div className="space-y-4">
                                {criticalLevels.map((level, index) => (
                                    <div key={level.name} className="flex items-center gap-3 p-3 rounded-xl bg-red-50/50 border border-red-100">
                                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-800 text-sm">{level.name}</p>
                                            <p className="text-xs text-red-500 font-medium">{level.collectionRate}% cobrado</p>
                                        </div>
                                    </div>
                                ))}
                                {criticalLevels.length === 0 && <p className="text-gray-400 text-sm italic">Sin niveles críticos.</p>}
                            </div>
                        </div>

                        <div className="bg-brand-green p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <PieChart size={100} />
                            </div>
                            <h3 className="font-serif font-bold text-xl mb-2 relative z-10">Estado Global</h3>
                            <p className="text-brand-gold text-sm font-medium mb-6 relative z-10">Distribución de pagos</p>

                            <div className="h-40 w-full relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={[
                                                { name: 'Pagado', value: stats.globalCollectionRate },
                                                { name: 'Pendiente', value: 100 - stats.globalCollectionRate },
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell key="paid" fill="#D4AF37" />
                                            <Cell key="pending" fill="rgba(255,255,255,0.2)" />
                                        </Pie>
                                        <Tooltip contentStyle={{ color: 'black', borderRadius: '8px' }} />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="text-center mt-2 relative z-10">
                                <p className="text-3xl font-bold">{Math.round(stats.globalCollectionRate)}%</p>
                                <p className="text-xs opacity-70 uppercase tracking-widest">Tasa de Éxito</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebtorsReport;
