
import React, { useState, useEffect, useRef } from 'react';
import { Student, ACADEMIC_LEVELS, SchedulesDoc, Level, MONTHS_AND_CONCEPTS, Transaction, FeesDoc } from '../types';
import { DataService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { Users, DollarSign, Search, AlertTriangle, Plus, ChevronRight, X, Filter, Trash2, RefreshCcw, Loader2, FileText, Download, FileSpreadsheet, Calendar, Banknote, Smartphone, PieChart, UploadCloud, Sparkles, CreditCard, ArrowRightLeft, User, MapPin, GraduationCap, Mail, Phone, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import { GoogleGenerativeAI } from "@google/generative-ai";

const MONTH_LABELS: { [key: string]: string } = {
    'enrolment': 'Enrolment',
    'march': 'March',
    'april': 'April',
    'may': 'May',
    'june': 'June',
    'july': 'July',
    'august': 'August',
    'september': 'September',
    'october': 'October',
    'november': 'November',
    'test': 'Final Exam'
};

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { instituteId } = useAuth();

    const [students, setStudents] = useState<Student[]>([]);
    const [schedules, setSchedules] = useState<SchedulesDoc>({});
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [fees, setFees] = useState<FeesDoc>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedMonth, setSelectedMonth] = useState<string>('march');
    const [showIncomeModal, setShowIncomeModal] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterLevel, setFilterLevel] = useState<string>('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null, name: string }>({
        isOpen: false,
        id: null,
        name: ''
    });
    const [isDeleting, setIsDeleting] = useState(false);

    const [newStudent, setNewStudent] = useState({
        name: '',
        dni: '',
        email: '',
        phone: '',
        level: ACADEMIC_LEVELS[0] as Level,
        address: '',
        schedule: ''
    });

    useEffect(() => {
        loadData();

        const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
        if (MONTHS_AND_CONCEPTS.includes(currentMonthName)) {
            setSelectedMonth(currentMonthName);
        } else {
            setSelectedMonth('march');
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [instituteId]);

    const loadData = async () => {
        if (!instituteId) return;
        if (students.length === 0) setLoading(true);
        setError(null);
        try {
            const [data, schedulesData, txs, feesData] = await Promise.all([
                DataService.getStudents(instituteId),
                DataService.getSchedules(instituteId),
                DataService.getTransactions(instituteId),
                DataService.getFees(instituteId)
            ]);
            setStudents(data);
            setSchedules(schedulesData);
            setTransactions(txs);
            setFees(feesData);

            if (!newStudent.schedule && schedulesData[ACADEMIC_LEVELS[0]]) {
                setNewStudent(prev => ({ ...prev, schedule: schedulesData[ACADEMIC_LEVELS[0]] || '' }));
            }

        } catch (err: any) {
            console.error("Error loading data:", err);
            if (err.code === 'permission-denied') {
                setError("Error de Seguridad: No tienes permisos para ver estos datos.");
            } else {
                setError("Error al cargar datos. Verifica tu conexión.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!instituteId) return;

        try {
            await DataService.createStudent(instituteId, {
                ...newStudent,
                payments: {}
            });
            setIsModalOpen(false);
            setNewStudent({
                name: '',
                dni: '',
                email: '',
                phone: '',
                level: ACADEMIC_LEVELS[0],
                address: '',
                schedule: schedules[ACADEMIC_LEVELS[0]] || ''
            });
            loadData();
        } catch (e) {
            alert("Error creando estudiante.");
        }
    };

    const handleLevelChange = (level: Level) => {
        setNewStudent({
            ...newStudent,
            level: level,
            schedule: schedules[level] || ''
        });
    };

    // --- SMART IMPORT LOGIC ---
    const handleSmartImport = async () => {
        if (!importText.trim() || !instituteId) return;
        setIsImporting(true);

        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                generationConfig: {
                    responseMimeType: "application/json"
                }
            });

            const prompt = `
          Analiza el siguiente texto y extrae una lista de estudiantes en formato JSON puro.
          El texto puede ser CSV, JSON malformado o texto natural copiado de un email o excel.
          
          Reglas:
          1. Extrae: Nombre, DNI, Email, Teléfono, Dirección.
          2. Nivel Académico: Debes mapear el nivel del texto a UNO de estos valores exactos: ${ACADEMIC_LEVELS.join(', ')}. Si no hay coincidencia exacta, usa el sentido común para elegir el más cercano (ej: "Jardín" -> "Kinder", "Adolescentes 1" -> "Teens 1").
          3. Horario: Si hay mención de días u horas, ponlo en 'schedule'.
          
          Responde SOLO con un ARRAY JSON válido de objetos con esta estructura:
          [
            { 
              "name": "string", 
              "dni": "string", 
              "email": "string", 
              "phone": "string", 
              "level": "Un valor exacto de la lista provista", 
              "address": "string", 
              "schedule": "string" 
            }
          ]

          Texto a procesar:
          ${importText}
        `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // El SDK devuelve el texto JSON listo para parsear
            const extractedStudents = JSON.parse(text);

            if (extractedStudents.length === 0) {
                alert("No pude identificar alumnos en el texto. Intenta pegar un formato más claro.");
                setIsImporting(false);
                return;
            }

            // Crear alumnos en Firebase
            let count = 0;
            for (const s of extractedStudents) {
                await DataService.createStudent(instituteId, {
                    name: s.name || "Sin Nombre",
                    dni: s.dni || "",
                    email: s.email || "",
                    phone: s.phone || "",
                    address: s.address || "",
                    level: s.level as Level,
                    schedule: s.schedule || schedules[s.level as Level] || "", // Usa el horario detectado o el default del nivel
                    payments: {}
                });
                count++;
            }

            alert(`¡Éxito! Se han importado ${count} alumnos correctamente.`);
            setImportText('');
            setShowImportModal(false);
            loadData();

        } catch (error: any) {
            console.error("Import Error:", error);
            alert(`Error: ${error.message || "Error al procesar con IA"}`);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteModal({ isOpen: true, id, name });
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;

        setIsDeleting(true);
        try {
            await DataService.deleteStudent(deleteModal.id);
            setStudents(prev => prev.filter(s => s.id !== deleteModal.id));
            setDeleteModal({ isOpen: false, id: null, name: '' });
        } catch (e: any) {
            console.error("Falló la eliminación:", e);
            if (e.code === 'permission-denied') {
                alert("Error de Permisos.");
            } else {
                alert(`Error al eliminar: ${e.message}`);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    // --- PDF EXPORTS ---
    const generateDataPDF = async () => {
        const doc = new jsPDF();
        const logoBase64 = await loadLogo();
        const pageWidth = doc.internal.pageSize.width;
        const today = new Date().toLocaleDateString();
        const title = filterLevel ? `Lista de Alumnos: ${filterLevel}` : `Lista de Alumnos (Todos)`;

        // Header with Logo
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
        }

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("LISTA DE ALUMNOS", 40, 20);
        doc.setFontSize(14);
        doc.text(title, 40, 28);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Generado el: ${today}`, 40, 34);

        let y = 50;

        // Group by Level
        const studentsByLevel: { [key: string]: Student[] } = {};
        ACADEMIC_LEVELS.forEach(l => studentsByLevel[l] = []);
        filteredStudentsForExport.forEach(s => {
            if (studentsByLevel[s.level]) studentsByLevel[s.level].push(s);
        });

        // Loop through levels in order
        ACADEMIC_LEVELS.forEach(level => {
            const levelStudents = studentsByLevel[level];
            if (levelStudents && levelStudents.length > 0) {
                // Check page break for Header
                if (y > 250) { doc.addPage(); y = 20; }

                // Level Header
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(22, 101, 52); // Brand Green
                doc.text(`--- ${level} ---`, 14, y);
                y += 10;
                doc.setTextColor(0, 0, 0);

                // Table Header
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setFillColor(240, 240, 240);
                doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
                doc.text("ALUMNO", 16, y);
                doc.text("DNI", 70, y);
                doc.text("TELÉFONO", 100, y);
                doc.text("HORARIO", 140, y);
                y += 10;
                doc.setFont("helvetica", "normal");

                // Sort alphabetically within level
                levelStudents.sort((a, b) => a.name.localeCompare(b.name)).forEach(student => {
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                        // Repeat Headers on new page
                        doc.setFont("helvetica", "bold");
                        doc.text(`--- ${level} (cont.) ---`, 14, y);
                        y += 10;
                        doc.setFontSize(8);
                        doc.setFillColor(240, 240, 240);
                        doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
                        doc.text("ALUMNO", 16, y);
                        doc.text("DNI", 70, y);
                        doc.text("TELÉFONO", 100, y);
                        doc.text("HORARIO", 140, y);
                        y += 10;
                        doc.setFont("helvetica", "normal");
                    }

                    const name = student.name.length > 30 ? student.name.substring(0, 30) + '...' : student.name;
                    doc.text(name.toUpperCase(), 16, y);
                    doc.text(student.dni || '-', 70, y);
                    doc.text(student.phone || '-', 100, y);
                    const schedLines = doc.splitTextToSize(student.schedule || '-', 50);
                    doc.text(schedLines, 140, y);

                    doc.setDrawColor(230, 230, 230);
                    doc.line(14, y + 2, pageWidth - 14, y + 2);
                    y += Math.max(8, schedLines.length * 5);
                });
                y += 10; // Space between levels
            }
        });

        doc.save(`Lista_Alumnos_${filterLevel || 'Completa'}.pdf`);
        setShowExportMenu(false);
    };

    const generatePaymentGridPDF = async () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const logoBase64 = await loadLogo();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const today = new Date().toLocaleDateString();
        const title = filterLevel ? `Planilla de Control: ${filterLevel}` : `Planilla de Control (General)`;

        const months = [
            { key: 'enrolment', label: 'ENR' },
            { key: 'march', label: 'MAR' },
            { key: 'april', label: 'APR' },
            { key: 'may', label: 'MAY' },
            { key: 'june', label: 'JUN' },
            { key: 'july', label: 'JUL' },
            { key: 'august', label: 'AUG' },
            { key: 'september', label: 'SEP' },
            { key: 'october', label: 'OCT' },
            { key: 'november', label: 'NOV' },
            { key: 'test', label: 'TEST' },
        ];

        // Header
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 14, 5, 15, 15);
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(title, 35, 15);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha Impresión: ${today}`, pageWidth - 50, 15);

        const startX = 10;
        let y = 30;
        const colName = 60;
        const colMonth = 17;

        // Group by Level
        const studentsByLevel: { [key: string]: Student[] } = {};
        ACADEMIC_LEVELS.forEach(l => studentsByLevel[l] = []);
        filteredStudentsForExport.forEach(s => {
            if (studentsByLevel[s.level]) studentsByLevel[s.level].push(s);
        });

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

        // Loop through levels
        ACADEMIC_LEVELS.forEach(level => {
            const levelStudents = studentsByLevel[level];
            if (levelStudents && levelStudents.length > 0) {
                // Check space for Level Header + Table Header + 1 Row
                if (y > pageHeight - 40) { doc.addPage(); y = 20; }

                // Level Header
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(22, 101, 52);
                doc.text(`--- ${level} ---`, startX, y);
                y += 6;
                doc.setTextColor(0, 0, 0);

                // Table Header
                drawHeader(y);
                y += 8;

                levelStudents.sort((a, b) => a.name.localeCompare(b.name)).forEach(student => {
                    if (y > pageHeight - 20) {
                        doc.addPage();
                        y = 20;
                        drawHeader(y); // Repeat table header on new page
                        y += 8;
                    }
                    doc.setDrawColor(200, 200, 200);
                    doc.line(startX, y + 4, pageWidth - 10, y + 4); // Horizontal line

                    // Vertical Lines (simplified, just outer and split)
                    // doc.line(startX, y - 6, startX, y + 4);
                    // doc.line(startX + colName, y - 6, startX + colName, y + 4);

                    doc.setFontSize(9);
                    const name = student.name.length > 22 ? student.name.substring(0, 22) + '.' : student.name;
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
                            doc.rect(cx + (colMonth / 2) - 2, y - 3, 4, 4); // Checkbox
                        }
                        cx += colMonth;
                    });
                    y += 8; // Row height
                });
                y += 10; // Space between levels
            }
        });

        doc.save(`Planilla_Pagos_${filterLevel || 'General'}.pdf`);
        setShowExportMenu(false);
    };

    const calculateIncomeBreakdown = () => {
        let total = 0, cash = 0, transfer = 0, card = 0;
        students.forEach(curr => {
            const payment = curr.payments[selectedMonth];
            if (payment?.paid) {
                const val = payment.amount;
                total += val;
                const method = payment.method;

                if (method === 'TRANSFER' || method === 'MP') transfer += val; // Agrupamos MP antiguo en transferencia
                else if (method === 'CARD') card += val;
                else cash += val; // Default cash
            }
        });
        return { total, cash, transfer, card };
    };

    const incomeStats = calculateIncomeBreakdown();

    const debtors = students.filter(s => {
        if (selectedMonth === 'enrolment') {
            const full = s.payments['enrolment']?.paid;
            const part1 = s.payments['enrolment_1']?.paid;
            return !full && !part1;
        }
        return !s.payments[selectedMonth]?.paid;
    });

    // Filter for Display (Show only debtors unless searching)
    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.dni.includes(searchTerm);
        const matchesLevel = filterLevel === '' || s.level === filterLevel;

        if (searchTerm) {
            return matchesSearch && matchesLevel;
        }

        // Check if student has pending payment for the selected month
        let isDebtor = false;
        if (selectedMonth === 'enrolment') {
            const full = s.payments['enrolment']?.paid;
            const part1 = s.payments['enrolment_1']?.paid;
            isDebtor = !full && !part1;
        } else {
            isDebtor = !s.payments[selectedMonth]?.paid;
        }

        return matchesLevel && isDebtor;
    });

    // Filter for Exports (Show ALL students in level/search, regardless of debt)
    const filteredStudentsForExport = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.dni.includes(searchTerm);
        const matchesLevel = filterLevel === '' || s.level === filterLevel;
        return matchesSearch && matchesLevel;
    });

    if (loading && students.length === 0) return <div className="flex h-full items-center justify-center p-10"><Loader2 className="animate-spin mr-2" /> Cargando Alumnos...</div>;

    if (error) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-10 text-center space-y-4">
                <div className="p-4 bg-red-100 text-red-600 rounded-full">
                    <AlertTriangle size={48} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Acceso Restringido</h2>
                <p className="text-gray-600 max-w-md">{error}</p>
                <button onClick={loadData} className="px-6 py-2 bg-brand-green text-white rounded-lg hover:bg-green-800 flex items-center gap-2">
                    <RefreshCcw size={18} /> Reintentar
                </button>
            </div>
        );
    }

    const generatePaymentGridCSV = () => {
        const headers = ['Alumno', 'Nivel', 'Matrícula', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Examen Final'];
        const keys = ['enrolment', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'test'];

        let csvContent = headers.join(',') + '\n';

        filteredStudentsForExport.forEach(student => { // Use ForExport list
            const row = [
                `"${student.name}"`, // Quote name to handle commas
                student.level,
                ...keys.map(key => student.payments[key]?.paid ? 'PAGADO' : '')
            ];
            csvContent += row.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Planilla_Pagos_${filterLevel || 'General'}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyToClipboard = () => {
        const headers = ['Alumno', 'Matrícula', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Examen'];
        const keys = ['enrolment', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'test'];

        let tsvContent = '';

        // Group by Level
        const studentsByLevel: { [key: string]: Student[] } = {};
        ACADEMIC_LEVELS.forEach(l => studentsByLevel[l] = []);
        filteredStudentsForExport.forEach(s => {
            if (studentsByLevel[s.level]) studentsByLevel[s.level].push(s);
        });

        ACADEMIC_LEVELS.forEach(level => {
            const levelStudents = studentsByLevel[level];
            if (levelStudents && levelStudents.length > 0) {
                // Level Header
                tsvContent += `--- ${level} ---\n`;
                // Column Headers
                tsvContent += headers.join('\t') + '\n';

                levelStudents.sort((a, b) => a.name.localeCompare(b.name)).forEach(student => {
                    const row = [
                        student.name,
                        ...keys.map(key => student.payments[key]?.paid ? 'PAGADO' : '')
                    ];
                    tsvContent += row.join('\t') + '\n';
                });
                tsvContent += '\n'; // Empty line between levels
            }
        });

        navigator.clipboard.writeText(tsvContent).then(() => {
            alert('¡Datos copiados! Pegalos en Excel/Sheets. Están ordenados por nivel.');
        }).catch(err => {
            console.error('Error al copiar: ', err);
            alert('No se pudo copiar.');
        });
    };

    // Helper to load image
    const loadLogo = async (): Promise<string | null> => {
        try {
            const response = await fetch('/logo.png');
            if (!response.ok) throw new Error('Logo not found');
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    };

    const generateFinancialBackupPDF = async () => {
        const doc = new jsPDF();
        const logoBase64 = await loadLogo();
        const today = new Date().toLocaleDateString();

        // --- DATA PREPARATION ---

        // 1. Calculate Totals
        const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);

        // 2. Calculate Debts (Simplified Logic from StudentCard)
        let totalDebt = 0;
        const debtorsList: any[] = [];

        students.forEach(s => {
            let studentDebt = 0;
            const debtDetails: string[] = [];
            const levelFees = fees[s.level] || { tuition: 0, enrolment: 0, test: 0 };

            // Enrolment
            if (!s.payments['enrolment']?.paid) {
                studentDebt += levelFees.enrolment;
                debtDetails.push('Matrícula');
            }

            // Months
            const monthMap: { [key: string]: number } = {
                'march': 2, 'april': 3, 'may': 4, 'june': 5,
                'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10
            };
            const currentMonthIdx = new Date().getMonth();

            Object.keys(monthMap).forEach(m => {
                if (monthMap[m] <= currentMonthIdx && !s.payments[m]?.paid) {
                    studentDebt += levelFees.tuition;
                    debtDetails.push(m.charAt(0).toUpperCase() + m.slice(1));
                }
            });

            if (studentDebt > 0) {
                totalDebt += studentDebt;
                debtorsList.push([s.name, s.level, `$${studentDebt.toLocaleString()}`, debtDetails.join(', ')]);
            }
        });

        // --- PDF GENERATION ---

        // PAGE 1: EXECUTIVE SUMMARY
        if (logoBase64) doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE FINANCIERO ANUAL", 40, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha de Emisión: ${today}`, 40, 32);
        doc.text("Este documento certifica el estado financiero total del instituto.", 14, 45);

        // Summary Cards (drawn as rectangles)
        doc.setDrawColor(200, 200, 200);

        // Card 1: Income
        doc.setFillColor(240, 253, 244); // Green light
        doc.rect(14, 55, 60, 30, 'F');
        doc.setFontSize(10);
        doc.setTextColor(22, 101, 52); // Green dark
        doc.text("INGRESOS TOTALES (Año)", 19, 65);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(`$ ${totalIncome.toLocaleString()}`, 19, 78);

        // Card 2: Debt
        doc.setFillColor(254, 242, 242); // Red light
        doc.rect(80, 55, 60, 30, 'F');
        doc.setFontSize(10);
        doc.setTextColor(153, 27, 27); // Red dark
        doc.text("DEUDA PENDIENTE", 85, 65);
        doc.setFontSize(16);
        doc.text(`$ ${totalDebt.toLocaleString()}`, 85, 78);

        // Card 3: Balance
        doc.setFillColor(239, 246, 255); // Blue light
        doc.rect(146, 55, 50, 30, 'F'); // Adjusted width to fit page
        doc.setFontSize(10);
        doc.setTextColor(30, 64, 175); // Blue dark
        doc.text("BALANCE POTENCIAL", 151, 65);
        doc.setFontSize(16);
        doc.text(`$ ${(totalIncome + totalDebt).toLocaleString()}`, 151, 78);

        // Reset Text Color
        doc.setTextColor(0, 0, 0);

        // SECTION 2: DEBTORS REPORT
        doc.setFontSize(14);
        doc.text("1. Detalle de Morosidad (Cuentas por Cobrar)", 14, 100);

        autoTable(doc, {
            startY: 105,
            head: [['Alumno', 'Nivel', 'Deuda', 'Conceptos Pendientes']],
            body: debtorsList,
            theme: 'grid',
            headStyles: { fillColor: [153, 27, 27], textColor: 255 }, // Red header
            styles: { fontSize: 8 },
        });

        // SECTION 3: TRANSACTIONS LOG (New Page automatically handled by autotable)
        const lastY = (doc as any).lastAutoTable.finalY; // Get Y position after previous table

        doc.setFontSize(14);
        doc.text("2. Libro Diario de Ingresos (Caja)", 14, lastY + 15);

        const txRows = transactions.map(t => [
            new Date(t.date).toLocaleDateString() + ' ' + new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            t.studentName,
            t.concept,
            t.method,
            `$${t.amount.toLocaleString()}`
        ]);

        autoTable(doc, {
            startY: lastY + 20,
            head: [['Fecha', 'Alumno', 'Concepto', 'Método', 'Monto']],
            body: txRows,
            theme: 'striped',
            headStyles: { fillColor: [22, 101, 52], textColor: 255 }, // Green header
            styles: { fontSize: 8 },
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Página ${i} de ${pageCount} - Generado por EduManage Software`, 100, 290, { align: 'center' });
        }

        doc.save(`Respaldo_Financiero_Completo_${new Date().getFullYear()}.pdf`);
    };

    return (
        <div className="space-y-8 relative max-w-7xl mx-auto pb-20">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <p className="text-sm font-medium text-brand-gold uppercase tracking-wider mb-1">Bienvenida</p>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">¡Hola, Directora!</h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Sistema activo
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-full border border-gray-200 shadow-soft">
                    <div className="pl-4 pr-2 py-1 text-gray-400 font-medium text-sm hidden md:block">Período Fiscal:</div>
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        <Calendar size={16} className="text-brand-green" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none outline-none text-gray-800 font-semibold text-sm cursor-pointer"
                        >
                            {MONTHS_AND_CONCEPTS.map(m => (
                                <option key={m} value={m}>{MONTH_LABELS[m] || m}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Alumnos */}
                <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100 relative overflow-hidden group hover:shadow-soft transition-all duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={80} className="text-brand-green" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-600 mb-4 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                        </div>
                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Total Alumnos</p>
                        <p className="text-4xl font-serif font-bold text-gray-900 mt-1">{students.length}</p>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Matrícula Activa
                        </div>
                    </div>
                </div>

                {/* Deudores - Interactive */}
                <div
                    onClick={() => navigate('/deudores')}
                    className="bg-white p-6 rounded-2xl shadow-card border border-gray-100 relative overflow-hidden group hover:shadow-soft transition-all duration-300 cursor-pointer"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertTriangle size={80} className="text-red-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mb-4 group-hover:scale-110 transition-transform">
                            <AlertTriangle size={24} />
                        </div>
                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
                            Pagos Pendientes
                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500" />
                        </p>
                        <p className="text-4xl font-serif font-bold text-gray-900 mt-1">{debtors.length}</p>
                        <p className="mt-4 text-xs font-medium text-red-500 flex items-center gap-1 group-hover:underline">
                            {debtors.length > 0 ? 'Ver reporte de morosidad' : '¡Todo al día!'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row justify-between gap-6 items-end">
                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                    <div className="relative flex-[2]">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-gray-400" size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar alumno por nombre o DNI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green shadow-sm outline-none text-gray-900 placeholder-gray-400 transition-all font-medium"
                        />
                    </div>

                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="text-gray-400" size={18} />
                        </div>
                        <select
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                            className="w-full pl-10 pr-10 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green shadow-sm outline-none text-gray-900 appearance-none cursor-pointer font-medium"
                        >
                            <option value="">Todos los Niveles</option>
                            {ACADEMIC_LEVELS.map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none">
                            <ChevronRight size={16} className="text-gray-400 rotate-90" />
                        </div>
                    </div>

                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="h-full px-6 bg-white border border-gray-200 text-gray-600 hover:text-brand-green hover:border-brand-green/30 font-medium rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all w-full md:w-auto min-w-[120px]"
                        >
                            <Download size={20} />
                            <span>Exportar</span>
                        </button>
                        {/* Export Menu remains same structure but styled */}
                        {showExportMenu && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-50"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Formatos Disponibles</span></div>
                                <button onClick={generateDataPDF} className="w-full px-5 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={18} /></div>
                                    <div><span className="font-semibold block text-gray-900">Lista de Alumnos</span><span className="text-xs text-gray-500">Datos personales y contacto</span></div>
                                </button>
                                <button onClick={generatePaymentGridPDF} className="w-full px-5 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><FileSpreadsheet size={18} /></div>
                                    <div><span className="font-semibold block text-gray-900">Grilla de Pagos (PDF)</span><span className="text-xs text-gray-500">Vista anual de cuotas</span></div>
                                </button>
                                <button onClick={generatePaymentGridCSV} className="w-full px-5 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors border-t border-gray-50">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><FileSpreadsheet size={18} /></div>
                                    <div><span className="font-semibold block text-gray-900">Exportar a Excel (CSV)</span><span className="text-xs text-gray-500">Para hojas de cálculo</span></div>
                                </button>
                                <button onClick={copyToClipboard} className="w-full px-5 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><UploadCloud size={18} /></div>
                                    <div><span className="font-semibold block text-gray-900">Copiar para Sheets</span><span className="text-xs text-gray-500">Pegar directo con Ctrl+V</span></div>
                                </button>
                                <button onClick={generateFinancialBackupPDF} className="w-full px-5 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors border-t border-gray-50">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ShieldCheck size={18} /></div>
                                    <div><span className="font-semibold block text-gray-900">Respaldo Financiero (PDF)</span><span className="text-xs text-gray-500">Garantía completa de datos</span></div>
                                </button>
                            </div>
                        )}
                    </div>
                </div >

                {/* Primary Actions */}
                < div className="flex gap-3 w-full lg:w-auto" >

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-brand-green text-white font-semibold rounded-xl hover:bg-[#254a36] hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-brand-green/30"
                    >
                        <Plus size={20} />
                        Nuevo Alumno
                    </button>
                </div >
            </div >

            {/* Content Area - Tables */}
            < div className="bg-white rounded-2xl shadow-card border border-gray-200/60 overflow-hidden min-h-[400px]" >
                {/* Table Header */}
                < div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center" >
                    <div>
                        <h3 className="font-serif font-bold text-xl text-gray-900">
                            {filterLevel ? `Estudiantes de ${filterLevel}` : (searchTerm ? 'Resultados de búsqueda' : 'Todos los Estudiantes')}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {filteredStudents.length} {filteredStudents.length === 1 ? 'registrado' : 'registrados'}
                        </p>
                    </div>
                </div >

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                                <th className="px-8 py-5">Estudiante</th>
                                <th className="px-6 py-5">Nivel</th>
                                <th className="px-6 py-5">Estado Pago</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map(s => (
                                    <tr key={s.id} className="group hover:bg-gray-50/80 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-serif font-bold text-sm">
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{s.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono mt-0.5">{s.dni || 'Sin DNI'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                {s.level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            {s.payments[selectedMonth]?.paid ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    Pagado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => navigate(`/student/${s.id}`)}
                                                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:border-brand-green hover:text-brand-green transition-colors shadow-sm"
                                                >
                                                    Ver Ficha
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(e, s.id, s.name)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                                <Search size={24} className="opacity-50" />
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">No se encontraron estudiantes</p>
                                            <p className="text-sm mt-1">Intenta con otro término de búsqueda o limpia los filtros.</p>
                                            {searchTerm && (
                                                <button onClick={() => { setSearchTerm(''); setFilterLevel(''); }} className="mt-4 text-brand-green font-medium hover:underline">
                                                    Limpiar búsqueda
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {showIncomeModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in duration-200 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 relative">
                        <div className="bg-brand-green/5 p-6 border-b border-brand-green/10 flex justify-between items-start">
                            <div>
                                <h3 className="font-serif font-bold text-gray-900 text-xl tracking-wide">Reporte de Ingresos</h3>
                                <p className="text-sm text-brand-green font-medium mt-1">{MONTH_LABELS[selectedMonth]}</p>
                            </div>
                            <div className="p-2 bg-white rounded-lg shadow-sm text-brand-green"><DollarSign size={20} /></div>
                        </div>
                        <button onClick={() => setShowIncomeModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>

                        <div className="p-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-green-100 group-hover:text-green-700 transition-colors"><Banknote size={16} /></div>
                                        <span className="font-medium text-gray-700">Efectivo</span>
                                    </div>
                                    <span className="font-bold text-gray-900">${incomeStats.cash.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors"><ArrowRightLeft size={16} /></div>
                                        <span className="font-medium text-gray-700">Transferencia</span>
                                    </div>
                                    <span className="font-bold text-gray-900">${incomeStats.transfer.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors"><CreditCard size={16} /></div>
                                        <span className="font-medium text-gray-700">Tarjeta</span>
                                    </div>
                                    <span className="font-bold text-gray-900">${incomeStats.card.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-serif font-bold text-gray-500 text-sm uppercase tracking-wider">Total Recaudado</span>
                                    <span className="font-serif font-bold text-2xl text-brand-green">${incomeStats.total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {
                showImportModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in duration-200 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-0 w-full max-w-2xl border border-gray-100 relative overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-50 to-white px-8 py-6 border-b border-indigo-50/50 flex items-center gap-4">
                                <div className="p-3 bg-white shadow-sm text-indigo-600 rounded-xl border border-indigo-50"><Sparkles size={24} /></div>
                                <div>
                                    <h3 className="font-serif font-bold text-gray-900 text-xl">Importación Inteligente</h3>
                                    <p className="text-sm text-gray-500 mt-1">Pega tu lista (Excel, CSV, texto) y la IA organizará los datos.</p>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                            </div>

                            <div className="p-8">
                                <div className="mb-6 relative group">
                                    <div className="absolute top-3 right-3 pointer-events-none">
                                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">TEXT / CSV</span>
                                    </div>
                                    <textarea
                                        className="w-full h-48 p-4 border border-gray-200 rounded-xl bg-gray-50/50 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none font-mono text-sm resize-none leading-relaxed"
                                        placeholder={`Ejemplo de formato (flexible):
Juan Perez, Kinder, 11223344
Maria Garcia | Teens 1 | maria@mail.com
Pedro Lopez - Adults 3 - DNI 33444555`}
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-400 mt-2 italic text-right">* La IA detectará automáticamente nombres, niveles y contactos.</p>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-50">
                                    <button onClick={() => setShowImportModal(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium rounded-xl transition-colors">Cancelar</button>
                                    <button
                                        onClick={handleSmartImport}
                                        disabled={isImporting || !importText.trim()}
                                        className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
                                    >
                                        {isImporting ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                                        {isImporting ? 'Procesando...' : 'Analizar e Importar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                deleteModal.isOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in duration-200 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-red-100 relative overflow-hidden text-center">
                            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-sm border border-red-100">
                                <Trash2 size={30} strokeWidth={1.5} />
                            </div>
                            <h3 className="font-serif font-bold text-2xl text-gray-900 mb-2">¿Eliminar Estudiante?</h3>
                            <p className="text-gray-500 mb-8 leading-relaxed">
                                Esta acción eliminará permanentemente a <span className="font-bold text-gray-800">{deleteModal.name}</span> del sistema.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setDeleteModal({ isOpen: false, id: null, name: '' })} disabled={isDeleting} className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">Cancelar</button>
                                <button onClick={confirmDelete} disabled={isDeleting} className="px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 flex items-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                    {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm p-4">
                        <div className="relative bg-white shadow-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all scale-100 border border-gray-100">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Nuevo Alumno</h2>
                                    <p className="text-sm text-gray-500 mt-1">Complete la ficha para registrar en el sistema.</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateStudent} className="p-8 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    {/* Nombre */}
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">Nombre Completo</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <User size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <input
                                                required
                                                autoFocus
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                                                placeholder="Ej: Juan Pérez"
                                                value={newStudent.name}
                                                onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* DNI */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">DNI / Identificación</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <CreditCard size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <input
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                                                placeholder="00.000.000"
                                                value={newStudent.dni}
                                                onChange={e => setNewStudent({ ...newStudent, dni: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Nivel */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">Nivel Académico</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <GraduationCap size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <select
                                                className="w-full pl-11 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-gray-900 font-medium appearance-none cursor-pointer"
                                                value={newStudent.level}
                                                onChange={e => handleLevelChange(e.target.value as Level)}
                                            >
                                                {ACADEMIC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                                <ChevronRight size={16} className="text-gray-400 rotate-90" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dirección */}
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">Dirección</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <MapPin size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <input
                                                required
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                                                placeholder="Calle Falsa 123"
                                                value={newStudent.address}
                                                onChange={e => setNewStudent({ ...newStudent, address: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">Email de Contacto</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Mail size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <input
                                                type="email"
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                                                placeholder="email@ejemplo.com"
                                                value={newStudent.email}
                                                onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Teléfono */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">Teléfono</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Phone size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <input
                                                type="tel"
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                                                placeholder="+54 11 1234 5678"
                                                value={newStudent.phone}
                                                onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Horario */}
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 ml-1">Días y Horarios</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Calendar size={18} className="text-gray-400 group-focus-within:text-brand-green transition-colors" />
                                            </div>
                                            <input
                                                readOnly
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-100 border border-gray-200 rounded-xl focus:ring-0 focus:border-gray-200 outline-none transition-all text-gray-500 placeholder-gray-400 font-medium cursor-not-allowed"
                                                placeholder="Se carga automáticamente según el nivel..."
                                                value={newStudent.schedule}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-[#16331f] shadow-lg shadow-brand-green/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                    >
                                        <Plus size={20} className="stroke-[3]" />
                                        Generar Ficha
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Dashboard;
