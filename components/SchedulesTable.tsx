import React, { useState, useEffect } from 'react';
import { SchedulesDoc, ACADEMIC_LEVELS } from '../types';
import { DataService } from '../services/db';
import { Save, RefreshCw, Clock, Calendar, Check, Edit3, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DAYS = [
  { id: 'Lun', label: 'L', full: 'Lunes' },
  { id: 'Mar', label: 'M', full: 'Martes' },
  { id: 'Mie', label: 'M', full: 'Miércoles' },
  { id: 'Jue', label: 'J', full: 'Jueves' },
  { id: 'Vie', label: 'V', full: 'Viernes' },
  { id: 'Sab', label: 'S', full: 'Sábado' },
];

const DigitalTimeInput: React.FC<{
  value: string,
  onChange: (val: string) => void,
  placeholder?: string
}> = ({ value, onChange }) => {
  const [h, m] = value ? value.split(':') : ['', ''];

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newH = e.target.value;
    if (!/^\d*$/.test(newH) || newH.length > 2) return;
    const num = parseInt(newH);
    if (!isNaN(num) && num > 23) newH = '23';
    updateTime(newH, m);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newM = e.target.value;
    if (!/^\d*$/.test(newM) || newM.length > 2) return;
    const num = parseInt(newM);
    if (!isNaN(num) && num > 59) newM = '59';
    updateTime(h, newM);
  };

  const handleBlur = () => {
    let finalH = h;
    let finalM = m;
    if (finalH.length === 1) finalH = `0${finalH}`;
    if (finalM.length === 1) finalM = `0${finalM}`;
    if (finalH === '') finalH = '00';
    if (finalM === '') finalM = '00';
    updateTime(finalH, finalM);
  };

  const updateTime = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
  };

  const numHour = parseInt(h || '0');
  const isPm = numHour >= 12;
  const period = isPm ? 'PM' : 'AM';

  return (
    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 transition-all group focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-green/20 focus-within:border-brand-green">
      <input type="text" value={h} onChange={handleHourChange} onBlur={handleBlur} placeholder="HH" className="w-8 text-center font-mono font-bold text-gray-900 bg-transparent outline-none text-lg placeholder-gray-300" />
      <span className="text-gray-300 font-bold mx-0.5 text-lg group-focus-within:text-brand-green">:</span>
      <input type="text" value={m} onChange={handleMinuteChange} onBlur={handleBlur} placeholder="MM" className="w-8 text-center font-mono font-bold text-gray-900 bg-transparent outline-none text-lg placeholder-gray-300" />
      <div className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isPm ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{period}</div>
    </div>
  );
};

interface ScheduleBuilderProps {
  level: string;
  currentValue: string;
  onChange: (val: string) => void;
}

const ScheduleRow: React.FC<ScheduleBuilderProps> = ({ level, currentValue, onChange }) => {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  useEffect(() => {
    if (!currentValue) return;
    // Simple parser logic could go here if needed to pre-populate from string
  }, []);

  const toggleDay = (dayId: string) => {
    if (isManualMode) return;
    let newDays;
    if (selectedDays.includes(dayId)) {
      newDays = selectedDays.filter(d => d !== dayId);
    } else {
      newDays = [...selectedDays, dayId].sort((a, b) => DAYS.findIndex(d => d.id === a) - DAYS.findIndex(d => d.id === b));
    }
    setSelectedDays(newDays);
    generateString(newDays, startTime, endTime);
  };

  const handleTimeChange = (type: 'start' | 'end', val: string) => {
    if (isManualMode) return;
    if (type === 'start') {
      setStartTime(val);
      generateString(selectedDays, val, endTime);
    } else {
      setEndTime(val);
      generateString(selectedDays, startTime, val);
    }
  };

  const generateString = (days: string[], start: string, end: string) => {
    if (days.length === 0 && (!start || start === ':') && (!end || end === ':')) {
      onChange('');
      return;
    }
    const dayStr = days.join(', ');
    let timeStr = '';
    const formatTimeForDisplay = (t: string) => (!t || t === ':') ? '' : t;
    const s = formatTimeForDisplay(start);
    const e = formatTimeForDisplay(end);
    if (s && e) timeStr = `${s} a ${e}hs`;
    else if (s) timeStr = `${s}hs`;

    const separator = (dayStr && timeStr) ? ' • ' : '';
    onChange(`${dayStr}${separator}${timeStr}`);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
      <div className="flex flex-col gap-6">

        {/* TOP SECTION: Level & Controls */}
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center border-b border-gray-100 pb-6 lg:border-0 lg:pb-0">

          {/* Level Indicator */}
          <div className="w-full lg:w-48 flex-shrink-0 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-green/5 text-brand-green flex items-center justify-center font-serif font-bold text-xl group-hover:bg-brand-green group-hover:text-white transition-colors shadow-sm">
              {level.substring(0, 2)}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">{level}</h3>
              <p className="text-xs text-brand-gold font-bold uppercase tracking-widest mt-0.5">Nivel Académico</p>
            </div>
          </div>

          {/* Builder Controls */}
          <div className={`flex-1 flex flex-col md:flex-row gap-8 transition-opacity duration-300 ${isManualMode ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>

            {/* Days */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={14} /> Días</span>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(day => {
                  const isSelected = selectedDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      className={`
                                      w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all border
                                      ${isSelected
                          ? 'bg-brand-green text-white border-brand-green shadow-lg shadow-brand-green/30 scale-105'
                          : 'bg-white text-gray-400 border-gray-100 hover:border-brand-green hover:text-brand-green'
                        }
                                  `}
                      title={day.full}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={14} /> Horario</span>
              <div className="flex items-center gap-3">
                <DigitalTimeInput value={startTime} onChange={(val) => handleTimeChange('start', val)} />
                <ArrowRight size={16} className="text-gray-300" />
                <DigitalTimeInput value={endTime} onChange={(val) => handleTimeChange('end', val)} />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Result & Manual Edit */}
        <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 relative animate-in fade-in slide-in-from-top-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resultado Final</span>
            <button
              onClick={() => setIsManualMode(!isManualMode)}
              className={`text-[10px] font-bold flex items-center gap-1 transition-colors ${isManualMode ? 'text-brand-green' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Edit3 size={10} />
              {isManualMode ? 'EDICIÓN MANUAL' : 'EDITAR'}
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={currentValue}
              onChange={(e) => onChange(e.target.value)}
              readOnly={!isManualMode}
              className={`w-full bg-transparent border-0 border-b-2 p-0 pb-1 text-sm font-medium focus:ring-0 transition-all ${isManualMode ? 'border-brand-green text-gray-900 placeholder-gray-400' : 'border-transparent text-gray-600 cursor-default'}`}
              placeholder="Sin horario definido..."
            />
          </div>
        </div>

      </div>
    </div>
  );
};

const SchedulesTable: React.FC = () => {
  const { instituteId } = useAuth();
  const [schedules, setSchedules] = useState<SchedulesDoc>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, [instituteId]);

  const loadSchedules = async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const data = await DataService.getSchedules(instituteId);
      setSchedules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (level: string, value: string) => {
    setSchedules(prev => ({
      ...prev,
      [level]: value
    }));
  };

  const saveSchedules = async () => {
    if (!instituteId) return;
    setIsSaving(true);
    try {
      await DataService.updateSchedules(instituteId, schedules);
      alert('¡Configuración guardada! Se han actualizado las fichas.');
    } catch (error) {
      console.error(error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

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
          <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">Configuración de Cursada</h2>
          <p className="text-gray-500 font-medium max-w-xl">Establece los días y horarios para cada nivel. Esta información se visualizará en las fichas de los alumnos.</p>
        </div>
        <button
          onClick={saveSchedules}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-brand-green text-white rounded-xl hover:bg-[#1e3f2e] shadow-lg shadow-brand-green/20 transition-all font-bold tracking-wide transform hover:-translate-y-0.5"
        >
          {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          {isSaving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
        </button>
      </div>

      <div className="space-y-4">
        {ACADEMIC_LEVELS.map(level => (
          <ScheduleRow key={level} level={level} currentValue={schedules[level] || ''} onChange={(val) => handleUpdate(level, val)} />
        ))}
      </div>
    </div>
  );
};

export default SchedulesTable;