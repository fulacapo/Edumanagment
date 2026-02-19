
import React, { useState, useEffect } from 'react';
import { Student, FeesDoc, SchedulesDoc, ACADEMIC_LEVELS } from '../types';
import { Printer, X, Edit2, Save, CreditCard, Banknote, Smartphone, QrCode, FileWarning, MessageCircle, StickyNote, Check, Trash2, Loader2, ArrowRightLeft, Landmark, CalendarClock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DataService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface StudentCardProps {
  student: Student;
  fees: FeesDoc;
  schedules?: SchedulesDoc; // Make it optional to avoid breaking if not passed immediately, though App.tsx passes it.
  onPaymentUpdated: () => void;
}

// Internal Interface for payment handling
interface PaymentIntent {
  conceptLabel: string; // Display name e.g. "Matrícula"
  dbKey: string;        // Database key e.g. "enrolment"
  amount: number;       // Price
  isInstallment?: boolean;
}

// --- CONFIGURACIÓN DE PAGO ---
const BANK_ALIAS = "edumanage.demo.alias"; // <--- CAMBIAR ESTO POR EL ALIAS REAL

const StudentCard: React.FC<StudentCardProps> = ({ student, fees, schedules = {}, onPaymentUpdated }) => {
  const { instituteId } = useAuth();
  const navigate = useNavigate();
  // Modal States
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null); // The clicked cell concept name
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null); // The actual payment to process

  // Payment Method States
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CARD' | null>(null);
  const [showTransferDetails, setShowTransferDetails] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Delete States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: student.name,
    address: student.address,
    dni: student.dni,
    level: student.level,
    email: student.email || '',
    phone: student.phone || '',
    // schedule removed from edit form
  });

  // Notes State
  const [notes, setNotes] = useState(student.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesChanged, setNotesChanged] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    // Reset Edit Form
    setEditForm({
      name: student.name,
      address: student.address,
      dni: student.dni,
      level: student.level,
      email: student.email || '',
      phone: student.phone || '',
    });
    // Reset Notes
    setNotes(student.notes || '');
    setNotesChanged(false);
  }, [student]);

  const getFeeValue = (type: 'tuition' | 'enrolment' | 'test') => {
    const levelFees = fees[student.level];
    if (!levelFees) return 0;
    return levelFees[type];
  };

  const getScheduleDisplay = () => {
    const schedule = schedules[student.level];
    if (!schedule || schedule.trim() === '') {
      return "⚠️ Aún no se cargó horario para este nivel.";
    }
    return schedule;
  };

  // Logic to determine what happens when a cell is clicked
  const handleCellClick = (concept: string) => {
    // Si ya está pagado, no hacemos nada (la UI ya muestra el recibo)
    if (student.payments[concept]?.paid) {
      setSelectedConcept(null);
      return;
    }

    setSelectedConcept(concept);
    setPaymentIntent(null);
    setPaymentMethod(null);
    setShowTransferDetails(false);

    let amount = 0;
    let label = concept.toUpperCase();

    if (concept === 'enrolment') {
      amount = getFeeValue('enrolment');
      label = 'ANNUAL ENROLMENT';
    } else if (concept === 'test') {
      amount = getFeeValue('test');
      label = 'FINAL EXAM';
    } else {
      amount = getFeeValue('tuition');
      // Translate month keys to English label
      const monthLabels: { [key: string]: string } = {
        'march': 'MARCH FEE',
        'april': 'APRIL FEE',
        'may': 'MAY FEE',
        'june': 'JUNE FEE',
        'july': 'JULY FEE',
        'august': 'AUGUST FEE',
        'september': 'SEPTEMBER FEE',
        'october': 'OCTOBER FEE',
        'november': 'NOVEMBER FEE'
      };
      label = monthLabels[concept] || label;
    }

    setPaymentIntent({
      conceptLabel: label,
      dbKey: concept,
      amount: amount
    });
  };

  const selectPaymentMethod = (method: 'CASH' | 'TRANSFER' | 'CARD') => {
    setPaymentMethod(method);
    if (method === 'TRANSFER') {
      setShowTransferDetails(true);
    }
  };

  const handleSaveStudent = async () => {
    setIsProcessing(true);
    try {
      // Remove schedule from the update payload as it's no longer editable per student
      const { schedule, ...updateData } = editForm as any; // Cast to avoid TS error if types aren't fully updated yet or if we just want to exclude it safely
      await DataService.updateStudent(student.id, updateData);
      setIsEditing(false);
      onPaymentUpdated();
    } catch (error) {
      console.error(error);
      alert("Error al actualizar estudiante");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await DataService.updateStudent(student.id, { notes });
      setNotesChanged(false);
      // Optional: onPaymentUpdated() if we want to refetch, but local state is fine here
    } catch (error) {
      console.error(error);
      alert("Error al guardar notas");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setNotesChanged(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      name: student.name,
      address: student.address,
      dni: student.dni,
      level: student.level,
      email: student.email || '',
      phone: student.phone || '',
    });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await DataService.deleteStudent(student.id);
      // Redirect to home/dashboard after deletion since this view is no longer valid
      navigate('/');
    } catch (e: any) {
      console.error("Falló la eliminación:", e);
      if (e.code === 'permission-denied') {
        alert("Error de Permisos: No tienes autorización para eliminar alumnos.");
      } else {
        alert(`Error al eliminar: ${e.message}`);
      }
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleWhatsApp = () => {
    if (!student.phone) {
      alert("El alumno no tiene un teléfono registrado.");
      return;
    }
    // Sanitize: remove non-numeric characters
    const cleanPhone = student.phone.replace(/\D/g, '');
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;
    window.open(url, '_blank');
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
      console.warn("No logo found at /logo.png, using default.");
      return null;
    }
  };

  // --- GENERACIÓN DE AVISO DE DEUDA ---
  const generateDebtNotice = async () => {
    const doc = new jsPDF();
    const today = new Date();
    const currentMonthIndex = today.getMonth(); // 0 = Jan, 11 = Dec

    // Configuración de Meses y sus índices aproximados para filtrar futuros
    const monthMap: { [key: string]: number } = {
      'march': 2, 'april': 3, 'may': 4, 'june': 5,
      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10
    };

    const debts: { concept: string, amount: number }[] = [];

    // 1. Check Enrolment (Standard)
    if (!student.payments['enrolment']?.paid) {
      debts.push({ concept: 'Annual Enrolment', amount: getFeeValue('enrolment') });
    }

    // 2. Check Monthly Fees
    const monthlyFee = getFeeValue('tuition');
    Object.keys(monthMap).forEach(key => {
      const monthIndex = monthMap[key];
      // Check only if the month has passed or is current
      if (monthIndex <= currentMonthIndex) {
        if (!student.payments[key]?.paid) {
          // Capitalize first letter
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          // Translate
          const translations: { [key: string]: string } = {
            'March': 'March Fee', 'April': 'April Fee', 'May': 'May Fee',
            'June': 'June Fee', 'July': 'July Fee', 'August': 'August Fee',
            'September': 'September Fee', 'October': 'October Fee', 'November': 'November Fee'
          };
          debts.push({ concept: translations[label] || label, amount: monthlyFee });
        }
      }
    });

    if (debts.length === 0) {
      alert("Este alumno no registra deudas vencidas a la fecha.");
      return;
    }

    const totalDebt = debts.reduce((sum, item) => sum + item.amount, 0);
    const logoBase64 = await loadLogo();

    // --- PDF DRAWING ---

    // Header Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 14, 14, 20, 20); // x, y, w, h
    } else {
      // Fallback
      doc.setFillColor(60, 110, 71);
      doc.circle(20, 20, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.text("EM", 16.5, 21);
    }

    // Header Text
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("DEBT NOTICE", 105, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${today.toLocaleDateString()}`, 160, 20);

    doc.setDrawColor(0, 0, 0);
    doc.line(10, 35, 200, 35); // Lowered line to make space for logo

    // Student Info
    doc.setFontSize(12);
    doc.text(`Student: ${student.name}`, 14, 45);
    doc.text(`Level: ${student.level}`, 14, 52);
    doc.text(`DNI: ${student.dni}`, 120, 45);

    doc.setFontSize(10);
    doc.text("We inform you of the account status to date, detailing", 14, 65);
    doc.text("the outstanding payment concepts:", 14, 70);

    // Table Header
    let y = 85;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 6, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("CONCEPT", 20, y);
    doc.text("AMOUNT", 160, y);
    y += 10;

    // Items
    doc.setFont("helvetica", "normal");
    debts.forEach(debt => {
      doc.text(debt.concept, 20, y);
      doc.text(`$ ${debt.amount.toLocaleString('es-AR')}`, 160, y);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, y + 2, 194, y + 2);
      y += 10;
    });

    // Total
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TOTAL DUE:", 100, y);
    doc.text(`$ ${totalDebt.toLocaleString('es-AR')}`, 160, y);

    // Footer
    y += 20;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("Please regularize your situation as soon as possible.", 14, y);
    doc.text("If you have already made the payment, please disregard this notice.", 14, y + 6);

    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("EduManage Software Pro", 14, 270);

    doc.save(`Debt_Notice_${student.name}.pdf`);
  };

  const generateReceipt = async (label: string, amount: number, date: string) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [148, 105] // A6
    });

    const logoBase64 = await loadLogo();

    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 10, 10, 20, 20);
    } else {
      doc.setFillColor(60, 110, 71);
      doc.circle(20, 20, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.text("EDU", 16, 19);
      doc.setFontSize(8);
      doc.text("MANAGE", 13, 22.5);
    }

    // Header
    doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("RECEIPT", 45, 15); // Moved right to avoid connection with larger logo

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(date).toLocaleDateString()}`, 100, 15);
    const receiptId = `${new Date().getFullYear()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    doc.text(`No: ${receiptId}`, 100, 20);

    doc.setDrawColor(100, 100, 100);
    doc.line(10, 32, 138, 32);

    doc.setFontSize(11);
    doc.text(`Received from:`, 10, 42);
    doc.setFont("helvetica", "bold");
    doc.text(student.name.toUpperCase(), 40, 42);

    doc.setFont("helvetica", "normal");
    doc.text(`The sum of:`, 10, 52);
    doc.setFont("helvetica", "bold");
    doc.text(`$ ${amount.toLocaleString('es-AR')}`, 40, 52);

    doc.setFont("helvetica", "normal");
    doc.text(`Concept:`, 10, 62);
    doc.setFont("helvetica", "bold");
    doc.text(`${label.toUpperCase()} - Level: ${student.level}`, 40, 62);

    // Forma de pago en recibo
    let methodText = 'Cash';
    if (paymentMethod === 'TRANSFER') methodText = 'Transfer';
    if (paymentMethod === 'CARD') methodText = 'Debit/Credit Card';
    if (paymentMethod === 'MP') methodText = 'Mercado Pago';

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`Payment Method: ${methodText}`, 40, 70);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("EduManage Software Pro", 10, 92);

    doc.setDrawColor(0, 0, 0);
    doc.line(90, 88, 138, 88);
    doc.setFont("times", "italic");
    doc.setFontSize(22);
    doc.setTextColor(20, 40, 80);
    doc.text("EduManage", 95, 85);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("Authorized Signature", 103, 92);

    doc.save(`Receipt_${student.name}_${label}.pdf`);
  };

  const confirmPayment = async () => {
    if (!paymentIntent) return;
    setIsProcessing(true);
    try {
      // Pass the selected payment method (default to CASH if somehow null, though UI prevents it)
      if (instituteId) {
        await DataService.recordPayment(instituteId, student.id, paymentIntent.dbKey, paymentIntent.amount, paymentMethod || 'CASH', student.name);
      } else {
        console.error("No institute ID found");
        alert("Error de sesión. Intente recargar.");
        return;
      }
      onPaymentUpdated();
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Error al procesar pago");
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setSelectedConcept(null);
    setPaymentIntent(null);
    setPaymentMethod(null);
    setShowTransferDetails(false);
  };

  const gridLayout = [
    { concept: 'test', label: 'FINAL EXAM' },
    { concept: 'november', label: 'NOVEMBER' },
    { concept: 'october', label: 'OCTOBER' },
    { concept: 'september', label: 'SEPTEMBER' },
    { concept: 'august', label: 'AUGUST' },
    { concept: 'july', label: 'JULY' },
    { concept: 'june', label: 'JUNE' },
    { concept: 'may', label: 'MAY' },
    { concept: 'april', label: 'APRIL' },
    { concept: 'march', label: 'MARCH' },
    { concept: 'enrolment', label: 'ENROLMENT' },
    { concept: 'empty', label: '' },
  ];

  return (
    <div className="flex justify-center p-4 md:p-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl shadow-xl max-w-5xl w-full border border-gray-100 relative overflow-hidden">

        {/* Top Decorative Bar */}
        <div className="h-3 bg-brand-green w-full"></div>

        {/* Action Bar (Floating) */}
        <div className="absolute top-6 right-6 z-20 flex gap-3">
          {!isEditing ? (
            <>
              <div className="flex bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl shadow-sm border border-gray-100 gap-1">
                <button
                  onClick={handleWhatsApp}
                  className="p-2.5 text-brand-green hover:bg-green-50 rounded-xl transition-all hover:scale-105"
                  title="WhatsApp"
                >
                  <MessageCircle size={20} />
                </button>
                <button
                  onClick={generateDebtNotice}
                  className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all hover:scale-105"
                  title="Aviso de Deuda"
                >
                  <FileWarning size={20} />
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2.5 text-gray-400 hover:text-brand-gold hover:bg-yellow-50 rounded-xl transition-all hover:scale-105"
                  title="Editar"
                >
                  <Edit2 size={20} />
                </button>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="Eliminar"
              >
                <Trash2 size={20} />
              </button>
            </>
          ) : (
            <div className="flex gap-2 bg-white/90 p-2 rounded-2xl shadow-lg border border-gray-100 animate-in slide-in-from-top-2">
              <button
                onClick={handleSaveStudent}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white font-medium rounded-xl hover:bg-[#1e3f2e] transition-colors shadow-sm"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar
              </button>
              <button
                onClick={cancelEdit}
                className="p-2.5 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>

        <div className="p-8 md:p-12 relative">
          {/* Background Texture */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row gap-10 mb-12 items-start">
            {/* Avatar / Logo */}
            <div className="flex-shrink-0 relative group">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-brand-green to-[#1e3f2e] flex items-center justify-center shadow-lg shadow-brand-green/20 transform rotate-3 transition-transform group-hover:rotate-0 duration-300">
                <span className="font-serif text-4xl text-white font-bold">{student.name.charAt(0)}</span>
              </div>
              <div className="absolute -bottom-3 -right-3 bg-white px-3 py-1 rounded-full shadow-md border border-gray-100 text-xs font-bold text-gray-600 uppercase tracking-widest">
                {student.level}
              </div>
            </div>

            {/* Student Info */}
            <div className="flex-1 space-y-6 pt-2">
              <div>
                {!isEditing ? (
                  <h1 className="font-serif text-4xl font-bold text-gray-900 leading-tight">{student.name}</h1>
                ) : (
                  <input
                    className="font-serif text-4xl font-bold text-gray-900 border-b-2 border-brand-green/20 focus:border-brand-green outline-none bg-transparent w-full placeholder-gray-300"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Nombre del Alumno"
                  />
                )}
                <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm font-medium">
                  <span className="flex items-center gap-1"><Smartphone size={14} /> {student.phone || '--'}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span className="flex items-center gap-1"><CreditCard size={14} /> DNI: {student.dni || '--'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm text-gray-600">
                <div className="group">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1 block group-hover:text-brand-green transition-colors">Dirección</label>
                  {isEditing ? (
                    <input className="w-full border-b border-gray-200 outline-none focus:border-brand-green py-1 bg-transparent" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="Dirección" />
                  ) : <p className="font-medium text-gray-800 border-b border-transparent py-1">{student.address || '--'}</p>}
                </div>

                <div className="group">
                  <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1 block group-hover:text-brand-green transition-colors">Email</label>
                  {isEditing ? (
                    <input className="w-full border-b border-gray-200 outline-none focus:border-brand-green py-1 bg-transparent" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="email@ejemplo.com" />
                  ) : <p className="font-medium text-gray-800 border-b border-transparent py-1 truncate">{student.email || '--'}</p>}
                </div>

                {isEditing && (
                  <>
                    <div className="group">
                      <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1 block">Teléfono</label>
                      <input className="w-full border-b border-gray-200 outline-none focus:border-brand-green py-1 bg-transparent" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Teléfono" />
                    </div>
                    <div className="group">
                      <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1 block">DNI</label>
                      <input className="w-full border-b border-gray-200 outline-none focus:border-brand-green py-1 bg-transparent" value={editForm.dni} onChange={e => setEditForm({ ...editForm, dni: e.target.value })} placeholder="DNI" />
                    </div>
                    <div className="group">
                      <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1 block">Nivel</label>
                      <select className="w-full border-b border-gray-200 outline-none focus:border-brand-green py-1 bg-transparent cursor-pointer" value={editForm.level} onChange={e => setEditForm({ ...editForm, level: e.target.value as any })}>
                        {ACADEMIC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {!isEditing && (
                  <div className="col-span-2 mt-2 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                    <CalendarClock size={20} className="text-brand-gold mt-0.5" />
                    <div>
                      <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide mb-1">Horario de Cursada</h4>
                      <p className="text-gray-700 font-medium">{getScheduleDisplay()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAYMENT GRID */}
          <div className="mb-12">
            <div className="flex items-end justify-between mb-6">
              <h2 className="font-serif font-bold text-2xl text-gray-900">Estado de Cuenta <span className="text-gray-300 font-light ml-2">{currentYear}</span></h2>
              <div className="flex gap-4 text-xs font-medium text-gray-500">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-200"></span> Pagado</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-white border border-gray-200"></span> Pendiente</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gridLayout.map((item, idx) => {
                if (item.concept === 'empty') return null;

                const isPaid = student.payments[item.concept]?.paid;
                const paymentData = student.payments[item.concept];

                return (
                  <div
                    key={item.concept}
                    onClick={() => handleCellClick(item.concept)}
                    className={`
                                    relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer group
                                    ${isPaid
                        ? 'bg-green-50/50 border-green-100 hover:border-green-200 hover:shadow-md'
                        : 'bg-white border-gray-100 hover:border-brand-green/30 hover:shadow-lg hover:-translate-y-1'
                      }
                                `}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className={`font-serif font-bold text-sm tracking-widest ${isPaid ? 'text-green-800' : 'text-gray-400 group-hover:text-brand-green transition-colors'}`}>
                        {item.label}
                      </span>
                      {isPaid ? (
                        <div className="bg-green-100 text-green-700 p-1.5 rounded-full"><Check size={14} /></div>
                      ) : (
                        <div className="bg-gray-50 text-gray-300 p-1.5 rounded-full group-hover:bg-brand-green group-hover:text-white transition-colors"><ArrowRightLeft size={14} /></div>
                      )}
                    </div>

                    {isPaid ? (
                      <div className="space-y-2 animate-in zoom-in duration-300">
                        <div className="text-center">
                          <p className="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">Pagado el</p>
                          <p className="text-lg font-bold text-green-800 font-mono">{new Date(paymentData.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateReceipt(item.label, paymentData.amount, paymentData.date);
                          }}
                          className="w-full mt-2 flex items-center justify-center gap-2 py-1.5 bg-white border border-green-200 rounded-lg text-green-700 text-xs font-bold hover:bg-green-50 transition-colors"
                        >
                          <Printer size={12} /> RECIBO
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-20 text-gray-300 group-hover:text-brand-green/60 transition-colors">
                        <p className="text-xs font-medium">Click para cobrar</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* NOTES */}
          <div className="bg-brand-gold/5 rounded-2xl p-6 border border-brand-gold/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3 font-serif">
                <div className="p-2 bg-white rounded-lg shadow-sm text-brand-gold"><StickyNote size={20} /></div>
                Notas y Seguimiento
              </h3>
              {notesChanged && (
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md hover:bg-yellow-600 transition-colors animate-in fade-in"
                >
                  {isSavingNotes ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {isSavingNotes ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>
            <textarea
              value={notes}
              onChange={handleNoteChange}
              placeholder="Escribe aquí observaciones sobre el alumno, faltas, reuniones con padres, etc..."
              className="w-full h-40 bg-white rounded-xl border border-brand-gold/20 p-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 resize-none font-serif leading-relaxed shadow-sm transition-all"
            />

          </div>
        </div>

        {/* MODAL 1: Payment Method Selection */}
        {(paymentIntent && !paymentMethod) && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white p-8 shadow-2xl max-w-lg w-full m-4 border border-gray-100 font-serif relative rounded-2xl text-center">
              <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>

              <h3 className="text-xl font-bold text-gray-900 mb-2 uppercase tracking-widest">Medio de Pago</h3>
              <p className="text-gray-500 text-sm mb-8 pb-4 border-b border-gray-100">
                Seleccione cómo desea registrar el cobro
              </p>

              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => selectPaymentMethod('CASH')}
                  className="flex flex-col items-center justify-center p-6 border border-gray-200 hover:border-green-600 hover:bg-green-50/50 transition-all group rounded-xl hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Banknote className="text-green-600" size={28} />
                  </div>
                  <span className="font-bold text-sm text-gray-800">Efectivo</span>
                </button>

                <button
                  onClick={() => selectPaymentMethod('TRANSFER')}
                  className="flex flex-col items-center justify-center p-6 border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all group rounded-xl hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Landmark className="text-blue-500" size={28} />
                  </div>
                  <span className="font-bold text-sm text-gray-800">Transferencia</span>
                </button>

                <button
                  onClick={() => selectPaymentMethod('CARD')}
                  className="flex flex-col items-center justify-center p-6 border border-gray-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all group rounded-xl hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <CreditCard className="text-purple-500" size={28} />
                  </div>
                  <span className="font-bold text-sm text-gray-800">Tarjeta</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Transfer Details (Alias) */}
        {(paymentIntent && paymentMethod === 'TRANSFER' && showTransferDetails) && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white p-6 shadow-2xl max-w-sm w-full m-4 rounded-2xl relative flex flex-col items-center border border-blue-100">
              <div className="w-full flex justify-between items-start mb-6">
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <ArrowRightLeft size={20} />
                  </div>
                  <span className="font-bold text-lg">Datos Bancarios</span>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-red-500 transition-clors"><X size={20} /></button>
              </div>

              <div className="bg-gray-50 border border-gray-200 dashed p-6 rounded-xl mb-6 w-full flex flex-col items-center justify-center text-center relative group">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Alias CBU / CVU</span>
                <p className="font-mono text-xl font-bold text-gray-800 break-all select-all">{BANK_ALIAS}</p>
              </div>

              <button
                onClick={() => setShowTransferDetails(false)} // Proceed to confirmation
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:-translate-y-0.5"
              >
                Listo, Continuar
              </button>
            </div>
          </div>
        )}

        {/* MODAL 3: Final Confirmation */}
        {
          (paymentIntent && paymentMethod && !showTransferDetails) && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 max-w-full m-4 border border-gray-100 font-serif relative">
                <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-red-600 transition-colors">
                  <X size={20} />
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Confirmar Pago</h3>
                  <p className="text-sm text-gray-500">Verifica los datos antes de registrar.</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-3 mb-6 border border-gray-100 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Alumno:</span>
                    <span className="font-bold text-gray-900">{student.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Concepto:</span>
                    <span className="font-bold text-gray-900">{paymentIntent.conceptLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Monto:</span>
                    <span className="font-bold text-gray-900">${paymentIntent.amount.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-gray-500">Método:</span>
                    <span className="font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-md text-xs uppercase">
                      {paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Tarjeta'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={confirmPayment}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-[#1e3f2e] shadow-lg shadow-brand-green/20 transition-all transform hover:-translate-y-0.5 flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={18} /> : null}
                    {isProcessing ? 'Procesando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL 4: Delete Confirmation */}
        {
          showDeleteModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-red-100 relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-sm border border-red-100">
                  <Trash2 size={30} strokeWidth={1.5} />
                </div>
                <h3 className="font-serif font-bold text-2xl text-gray-900 mb-2">¿Eliminar Estudiante?</h3>
                <p className="text-gray-500 mb-8 leading-relaxed">
                  Esta acción eliminará permanentemente a <span className="font-bold text-gray-800">{student.name}</span>.<br />
                  <span className="text-red-500 text-sm font-medium">Esta acción no se puede deshacer.</span>
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">Cancelar</button>
                  <button onClick={confirmDelete} disabled={isDeleting} className="px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 flex items-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
                    {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          )
        }

      </div>
    </div>
  );
};

export default StudentCard;
