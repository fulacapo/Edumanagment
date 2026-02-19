
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircleQuestion, X, Send, Loader2, Sparkles, Minimize2 } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Message {
  role: 'user' | 'model';
  text: string;
}

// Resumen comprimido de la funcionalidad de la App para que el bot sepa qué responder
const SYSTEM_INSTRUCTION = `Eres "EduBot", el asistente virtual simpático y experto de la aplicación "EduManage Pro".
Tu objetivo es ayudar a los administradores a usar el sistema. Responde de forma breve, clara y en español.
Usa emojis ocasionalmente.

CONOCIMIENTO DE LA APP:
1. DASHBOARD:
   - "Nuevo Alumno": Botón verde grande. Pide datos personales y nivel.
   - "Exportar": Botón descarga lista de alumnos o planilla de control en PDF.
   - "Buscador": Filtra por nombre/DNI y Nivel.
   - "Métricas": Muestra ingresos del mes seleccionado y deudores.

2. ALUMNOS (Ficha):
   - "Registrar Pago": Click en la celda del mes (ej: MAR, ABR) o Matrícula. Seleccionar efectivo o Mercado Pago.
   - "Generar Recibo": Si ya está pagado, aparece un botón "Recibo" (ícono impresora) en la celda.
   - "Editar Datos": Botón lápiz arriba a la derecha.
   - "WhatsApp": Botón verde con ícono de mensaje para abrir chat directo.
   - "Aviso Deuda": Botón rojo de alerta para generar PDF de deuda.

3. CONFIGURACIÓN:
   - "Config. Precios": Define valor de cuota y matrícula por nivel. Opción de "Aumento Masivo" (calculadora).
   - "Config. Cursada": Define horarios (días y horas). Al guardar, actualiza automáticamente a todos los alumnos de ese nivel.

4. ELIMINAR:
   - Se hace desde la lista en el Dashboard o lista de Alumnos, ícono de basura rojo.

REGLAS:
- Si te saludan, preséntate como EduBot.
- Si preguntan algo fuera de la gestión escolar, di amablemente que solo sabes de EduManage.
- Sé conciso. No des explicaciones larguísimas.
`;

const HelpBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: '¡Hola! Soy EduBot 🤖. ¿En qué puedo ayudarte hoy con la app?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Referencia para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mantener instancia del chat en memoria mientras el componente viva
  const chatSessionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const getChatSession = () => {
    if (!chatSessionRef.current) {
      // Usamos la API Key del entorno.
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION
      });

      chatSessionRef.current = model.startChat({
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.5,
        }
      });
    }
    return chatSessionRef.current;
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const chat = getChatSession();
      const result = await chat.sendMessage(userMsg);
      const responseText = result.response.text();

      setMessages(prev => [...prev, { role: 'model', text: responseText || 'Lo siento, no pude procesar eso.' }]);
    } catch (error) {
      console.error("Bot Error:", error);
      // Si hay un error de "Entity not found", reiniciamos la sesión (puede ser un cambio de versión de modelo en el backend de Google)
      chatSessionRef.current = null;
      setMessages(prev => [...prev, { role: 'model', text: 'Ups, tuve un pequeño problema técnico. ¿Podrías repetir tu pregunta?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end pointer-events-none">

      {/* VENTANA DE CHAT */}
      {isOpen && (
        <div className="bg-white w-80 md:w-96 h-[500px] rounded-2xl shadow-2xl border border-gray-100 mb-6 flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-300 relative z-50">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-green to-[#1e3f2e] p-5 flex justify-between items-center text-white shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Sparkles size={60} />
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
                <Sparkles size={18} className="text-brand-gold" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base tracking-wide">Asistente EduManage</h3>
                <p className="text-[10px] text-green-100 opacity-90 flex items-center gap-1.5 uppercase tracking-wider font-medium">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                  En línea con IA
                </p>
              </div>
            </div>
            <button onClick={toggleOpen} className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-all relative z-10">
              <Minimize2 size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 bg-[#F9FAFB] space-y-5 scroll-smooth">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                                max-w-[85%] p-4 text-sm shadow-sm leading-relaxed
                                ${msg.role === 'user'
                      ? 'bg-brand-green text-white rounded-2xl rounded-br-none'
                      : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-bl-none'}
                            `}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                  <Loader2 size={16} className="animate-spin text-brand-green" />
                  <span className="text-xs text-gray-400 font-medium tracking-wide">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-50 flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta..."
              className="flex-1 bg-gray-50 text-gray-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:bg-white border border-gray-100 transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="group bg-brand-green text-white p-3 rounded-xl hover:bg-[#1e3f2e] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-green/20 hover:shadow-lg hover:-translate-y-0.5"
            >
              <Send size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </form>
        </div>
      )}

      {/* BOTÓN FLOTANTE */}
      <button
        onClick={toggleOpen}
        className={`
            pointer-events-auto
            flex items-center justify-center
            w-14 h-14 rounded-full shadow-2xl shadow-brand-green/30
            transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-white
            ${isOpen ? 'bg-gray-800 text-white rotate-90' : 'bg-gradient-to-br from-brand-gold to-yellow-600 text-white hover:brightness-110'}
        `}
        title="Ayuda con IA"
      >
        {isOpen ? <X size={24} /> : <MessageCircleQuestion size={28} />}
      </button>
    </div>
  );
};

export default HelpBot;
