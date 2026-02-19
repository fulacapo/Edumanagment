import React, { useState, useEffect } from 'react';
import { FeesDoc, ACADEMIC_LEVELS, FeeStructure } from '../types';
import { DataService } from '../services/db';
import { Save, RefreshCw, Calculator, DollarSign, TrendingUp, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FeesTable: React.FC = () => {
  const { instituteId } = useAuth();
  const [fees, setFees] = useState<FeesDoc>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [updatePercent, setUpdatePercent] = useState<string>('10');
  const [updateColumn, setUpdateColumn] = useState<keyof FeeStructure>('tuition');
  const [showMassUpdate, setShowMassUpdate] = useState(false);

  useEffect(() => {
    loadFees();
  }, [instituteId]);

  const loadFees = async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const data = await DataService.getFees(instituteId);
      setFees(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (level: string, field: keyof FeeStructure, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value);
    setFees(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        [field]: isNaN(numValue) ? 0 : numValue
      }
    }));
  };

  const handleGlobalEnrolmentChange = (value: string) => {
    const numValue = value === '' ? 0 : parseInt(value);
    const val = isNaN(numValue) ? 0 : numValue;
    setFees(prev => {
      const newFees = { ...prev };
      ACADEMIC_LEVELS.forEach(level => {
        if (!newFees[level]) {
          newFees[level] = { tuition: 0, enrolment: val, test: 0 };
        } else {
          newFees[level] = { ...newFees[level], enrolment: val };
        }
      });
      return newFees;
    });
  };

  const saveFees = async () => {
    if (!instituteId) return;
    setIsSaving(true);
    try {
      await DataService.updateFees(instituteId, fees);
      alert('¡Precios guardados correctamente!');
    } catch (error) {
      console.error(error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const applyMassUpdate = () => {
    const percent = parseFloat(updatePercent);
    if (isNaN(percent)) return;

    const newFees = { ...fees };
    ACADEMIC_LEVELS.forEach(level => {
      if (newFees[level]) {
        const oldValue = newFees[level][updateColumn];
        newFees[level] = {
          ...newFees[level],
          [updateColumn]: Math.round(oldValue * (1 + percent / 100))
        };
      }
    });
    setFees(newFees);
    setShowMassUpdate(false);
  };

  const currentGlobalEnrolment = fees[ACADEMIC_LEVELS[0]]?.enrolment || 0;

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <RefreshCw className="animate-spin text-brand-green" size={32} />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">Configuración de Precios</h2>
          <p className="text-gray-500 font-medium max-w-xl">Administra los valores de las cuotas, exámenes y matrículas para el ciclo lectivo actual.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowMassUpdate(!showMassUpdate)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all font-medium shadow-sm hover:shadow-md ${showMassUpdate ? 'bg-brand-gold text-white border-brand-gold' : 'bg-white border-gray-200 text-gray-700 hover:border-brand-gold hover:text-brand-gold'}`}
          >
            <TrendingUp size={20} />
            {showMassUpdate ? 'Ocultar Herramientas' : 'Actualización Masiva'}
          </button>

          <button
            onClick={saveFees}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-brand-green text-white rounded-xl hover:bg-[#1e3f2e] shadow-lg shadow-brand-green/20 transition-all font-bold tracking-wide transform hover:-translate-y-0.5"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
            {isSaving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
          </button>
        </div>
      </div>

      {/* Calculator Section / Top Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matrícula Global Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <DollarSign size={80} />
          </div>
          <div className="flex items-start gap-4 mb-4 relative z-10">
            <div className="p-3 bg-brand-green/10 text-brand-green rounded-xl">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-serif">Matrícula Anual</h3>
              <p className="text-xs text-gray-500 mt-1">Valor único para todos los niveles</p>
            </div>
          </div>

          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              value={currentGlobalEnrolment === 0 ? '' : currentGlobalEnrolment}
              onChange={(e) => handleGlobalEnrolmentChange(e.target.value)}
              className="w-full pl-8 pr-4 py-4 text-3xl font-bold text-gray-900 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-brand-green outline-none transition-all placeholder-gray-300"
              placeholder="0"
            />
          </div>
        </div>

        {/* Mass Update Tool */}
        {showMassUpdate && (
          <div className="lg:col-span-2 bg-gradient-to-br from-[#fcfbf7] to-white border border-brand-gold/20 p-6 rounded-2xl relative overflow-hidden animate-in slide-in-from-left-4 fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-brand-gold text-white rounded-lg shadow-sm"><Calculator size={20} /></div>
              <h3 className="font-bold text-gray-800 font-serif">Aumento Porcentual Masivo</h3>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2 block">Aplicar a:</label>
                <select
                  value={updateColumn}
                  onChange={(e) => setUpdateColumn(e.target.value as keyof FeeStructure)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 cursor-pointer font-medium"
                >
                  <option value="tuition">Cuota Mensual</option>
                  <option value="test">Derecho de Examen</option>
                  <option value="enrolment">Matrícula (Todos)</option>
                </select>
              </div>

              <div className="w-32">
                <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2 block">Porcentaje</label>
                <div className="relative">
                  <input
                    type="number"
                    value={updatePercent}
                    onChange={(e) => setUpdatePercent(e.target.value)}
                    className="w-full pl-4 pr-8 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/50 font-bold text-center"
                  />
                  <span className="absolute right-3 top-3 text-gray-400 font-bold">%</span>
                </div>
              </div>

              <button
                onClick={applyMassUpdate}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black font-bold shadow-lg shadow-gray-200 transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                <TrendingUp size={18} /> Aplicar
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-orange-600 font-medium bg-orange-50 p-2 rounded-lg inline-flex">
              <AlertCircle size={14} />
              Esta acción modificará los valores de TODOS los niveles.
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-6 font-serif font-bold text-gray-700 text-lg">Nivel Académico</th>
                <th className="px-8 py-6 font-serif font-bold text-gray-700 w-64 text-center">Cuota Mensual</th>
                <th className="px-8 py-6 font-serif font-bold text-gray-700 w-64 text-center">Derecho de Examen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ACADEMIC_LEVELS.map((level, idx) => {
                const current = fees[level] || { tuition: 0, enrolment: 0, test: 0 };
                const isEven = idx % 2 === 0;

                return (
                  <tr key={level} className={`group hover:bg-green-50/30 transition-colors ${isEven ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-brand-green group-hover:text-white transition-colors">
                          {level.substring(0, 2)}
                        </span>
                        <span className="font-bold text-gray-800 text-lg group-hover:text-brand-green transition-colors">{level}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="relative group/input">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-brand-green transition-colors font-medium">$</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={current.tuition === 0 ? '' : current.tuition}
                          onChange={(e) => handleInputChange(level, 'tuition', e.target.value)}
                          className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all placeholder-gray-300 text-gray-900 font-bold text-center group-hover/input:border-gray-300"
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="relative group/input">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-brand-green transition-colors font-medium">$</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={current.test === 0 ? '' : current.test}
                          onChange={(e) => handleInputChange(level, 'test', e.target.value)}
                          className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all placeholder-gray-300 text-gray-900 font-bold text-center group-hover/input:border-gray-300"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeesTable;