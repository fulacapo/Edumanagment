import React, { useState, useEffect } from 'react';
import { DataService } from '../services/db';
import { Student, ACADEMIC_LEVELS } from '../types';
import { Link } from 'react-router-dom';
import { Users, FileText, FileSpreadsheet, ChevronDown, ChevronUp, User, Search, Filter } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../contexts/AuthContext';

const StudentsList: React.FC = () => {
  const { instituteId } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [instituteId]);

  const loadData = async () => {
    if (!instituteId) return;
    try {
      const data = await DataService.getStudents(instituteId);
      setStudents(data);
    } catch (error) {
      console.error("Error loading students:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentsByLevel = (level: string) => {
    return students
      .filter(s => s.level === level)
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleLevel = (level: string) => {
    if (expandedLevel === level) {
      setExpandedLevel(null);
    } else {
      setExpandedLevel(level);
    }
  };

  const generateDataPDF = (e: React.MouseEvent, level: string, levelStudents: Student[]) => {
    e.stopPropagation();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const today = new Date().toLocaleDateString();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("EduManage Software Pro", 14, 20);
    doc.setFontSize(12);
    doc.text(`Lista de Alumnos: ${level}`, 14, 28);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${today}`, pageWidth - 40, 20);

    let y = 40;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(60, 110, 71);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 5, pageWidth - 28, 8, 'F');

    const xName = 16, xDni = 80, xPhone = 110, xSched = 150;
    doc.text("ALUMNO", xName, y);
    doc.text("DNI", xDni, y);
    doc.text("TELÉFONO", xPhone, y);
    doc.text("HORARIO", xSched, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    levelStudents.forEach((student) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFont("helvetica", "bold");
        doc.setFillColor(60, 110, 71);
        doc.setTextColor(255, 255, 255);
        doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
        doc.text("ALUMNO", xName, y);
        doc.text("DNI", xDni, y);
        doc.text("TELÉFONO", xPhone, y);
        doc.text("HORARIO", xSched, y);
        y += 10;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      }
      const name = student.name.length > 30 ? student.name.substring(0, 30) + '...' : student.name;
      doc.text(name.toUpperCase(), xName, y);
      doc.text(student.dni || '-', xDni, y);
      doc.text(student.phone || '-', xPhone, y);
      const schedLines = doc.splitTextToSize(student.schedule || '-', 45);
      doc.text(schedLines, xSched, y);
      doc.setDrawColor(240, 240, 240);
      doc.line(14, y + 2, pageWidth - 14, y + 2);
      y += Math.max(8, schedLines.length * 5);
    });
    doc.save(`Lista_${level.replace(' ', '_')}.pdf`);
  };

  const generatePaymentGridPDF = (e: React.MouseEvent, level: string, levelStudents: Student[]) => {
    e.stopPropagation();
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const today = new Date().toLocaleDateString();

    const months = [
      { key: 'enrolment', label: 'MAT' },
      { key: 'march', label: 'MAR' },
      { key: 'april', label: 'ABR' },
      { key: 'may', label: 'MAY' },
      { key: 'june', label: 'JUN' },
      { key: 'july', label: 'JUL' },
      { key: 'august', label: 'AGO' },
      { key: 'september', label: 'SEP' },
      { key: 'october', label: 'OCT' },
      { key: 'november', label: 'NOV' },
      { key: 'test', label: 'TEST' },
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Planilla de Control: ${level}`, 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${today}`, pageWidth - 50, 15);

    const startX = 10, startY = 25;
    let y = startY;
    const colName = 60, colMonth = 17;

    const drawHeader = (currentY: number) => {
      doc.setFillColor(60, 110, 71);
      doc.rect(startX, currentY - 5, pageWidth - 20, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ALUMNO", startX + 2, currentY);
      let cx = startX + colName;
      months.forEach(m => {
        doc.text(m.label, cx + 5, currentY);
        cx += colMonth;
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
    };

    drawHeader(y);
    y += 8;

    levelStudents.forEach((student) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
        drawHeader(y);
        y += 8;
      }
      doc.setDrawColor(200, 200, 200);
      doc.line(startX, y + 4, pageWidth - 10, y + 4);
      doc.line(startX, y - 6, startX, y + 4);
      doc.line(startX + colName, y - 6, startX + colName, y + 4);
      let vx = startX + colName;
      months.forEach(() => {
        vx += colMonth;
        doc.line(vx, y - 6, vx, y + 4);
      });

      doc.setFontSize(9);
      const name = student.name.length > 28 ? student.name.substring(0, 28) + '.' : student.name;
      doc.text(name, startX + 2, y);

      let cx = startX + colName;
      months.forEach(m => {
        const isPaid = student.payments[m.key]?.paid;
        const isEnrolmentPart = m.key === 'enrolment' && (student.payments['enrolment_1']?.paid);

        if (isPaid) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(60, 110, 71);
          doc.text("PAGADO", cx + 2, y);
          doc.setTextColor(0, 0, 0);
        } else if (isEnrolmentPart && m.key === 'enrolment') {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(230, 140, 0);
          doc.text("1/2 PAG", cx + 2, y);
          doc.setTextColor(0, 0, 0);
        } else {
          doc.setDrawColor(150, 150, 150);
          doc.rect(cx + (colMonth / 2) - 2, y - 3, 4, 4);
        }
        cx += colMonth;
      });
      y += 10;
    });

    doc.save(`Pagos_${level.replace(' ', '_')}.pdf`);
  };

  if (loading) return <div className="p-10 text-center">Cargando Niveles...</div>;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">Alumnos por Nivel</h2>
          <p className="text-gray-500 font-medium">Gestión de cursos, listas y fichas de estudiantes.</p>
        </div>

        {/* Search Bar */}
        <div className="w-full md:w-auto relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-green transition-colors">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Buscar alumno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80 pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all shadow-sm group-hover:shadow-md"
          />
          {searchTerm && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-brand-green text-white px-2 py-0.5 rounded-full font-bold">
              Filtrando
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {ACADEMIC_LEVELS.map((level) => {
          const levelStudents = getStudentsByLevel(level);
          const count = levelStudents.length;
          // If searching, auto-expand levels with matches
          const isExpanded = searchTerm ? count > 0 : expandedLevel === level;

          if (searchTerm && count === 0) return null;

          return (
            <div key={level} className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 ${isExpanded ? 'border-brand-green ring-1 ring-brand-green shadow-md' : 'border-gray-100 hover:border-brand-green/50 hover:shadow-md'}`}>
              <div onClick={() => toggleLevel(level)} className="p-6 flex items-center justify-between cursor-pointer select-none">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm transition-colors ${count > 0 ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {level.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 font-serif">{level}</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                      {count === 1 ? '1 Alumno' : `${count} Alumnos`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {count > 0 && (
                    <div className="flex gap-2">
                      <button onClick={(e) => generateDataPDF(e, level, levelStudents)} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-transparent hover:border-blue-100 hover:scale-105 shadow-sm" title="Descargar Lista de Datos">
                        <FileText size={18} />
                        <span className="hidden md:inline">DATOS</span>
                      </button>
                      <button onClick={(e) => generatePaymentGridPDF(e, level, levelStudents)} className="p-2.5 text-green-700 hover:bg-green-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-transparent hover:border-green-100 hover:scale-105 shadow-sm" title="Descargar Planilla de Pagos">
                        <FileSpreadsheet size={18} />
                        <span className="hidden md:inline">PAGOS</span>
                      </button>
                    </div>
                  )}
                  <div className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-brand-green' : ''}`}>
                    <ChevronDown size={24} />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-2 rounded-b-2xl">
                  {count === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic flex flex-col items-center gap-2">
                      <Users size={32} className="opacity-20" />
                      No hay alumnos registrados en este nivel.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {levelStudents.map(student => (
                        <Link key={student.id} to={`/student/${student.id}`} className="bg-white p-4 rounded-xl border border-gray-200 hover:border-brand-green hover:shadow-lg transition-all flex items-center gap-4 group relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-brand-green/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 group-hover:bg-brand-green/10"></div>

                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-brand-green group-hover:text-white transition-colors shadow-sm z-10">
                            <User size={18} />
                          </div>
                          <div className="overflow-hidden z-10">
                            <p className="font-bold text-gray-900 truncate group-hover:text-brand-green transition-colors font-serif">{student.name}</p>
                            <p className="text-[10px] text-gray-500 truncate font-mono mt-0.5">DNI: {student.dni || '---'}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentsList;