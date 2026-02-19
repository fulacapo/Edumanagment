import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { Student, FeesDoc, ACADEMIC_LEVELS, Level, SchedulesDoc, Transaction } from '../types';

export const DataService = {
  // --- ONBOARDING & TENANT INIT ---
  async initializeTenant(uid: string, email: string): Promise<void> {
    if (!uid) throw new Error("UID invalido para inicialización");

    try {
      console.log("Iniciando configuración para Tenant:", uid);
      const batch = writeBatch(db);

      // 1. Inicializar Fees (Todo en 0)
      const defaultFees: FeesDoc = {};
      ACADEMIC_LEVELS.forEach(l => {
        defaultFees[l] = { tuition: 0, enrolment: 0, test: 0 };
      });
      // Importante: Usamos el UID como ID del documento
      const feesRef = doc(db, 'config_fees', uid);
      // Incluimos instituteId en la data por redundancia y validación futura
      batch.set(feesRef, { ...defaultFees, instituteId: uid });

      // 2. Inicializar Schedules (Vacíos)
      const defaultSchedules: SchedulesDoc = {};
      ACADEMIC_LEVELS.forEach(l => {
        defaultSchedules[l] = "";
      });
      const schedulesRef = doc(db, 'config_schedules', uid);
      batch.set(schedulesRef, { ...defaultSchedules, instituteId: uid });

      // 3. Crear Perfil de Instituto (Meta-data)
      const instituteRef = doc(db, 'institutes', uid);
      batch.set(instituteRef, {
        email,
        instituteId: uid,
        createdAt: new Date().toISOString(),
        plan: 'FREE',
        settings: { currency: 'ARS', language: 'es' }
      });

      await batch.commit();
      console.log("Tenant inicializado correctamente.");

    } catch (error: any) {
      console.error("Error crítico en initializeTenant:", error);
      // Re-lanzamos el error para que la UI lo muestre
      if (error.code === 'permission-denied') {
        throw new Error("Permiso denegado al crear la base de datos. Verifique las reglas de Firestore.");
      }
      throw error;
    }
  },

  // --- FEES ---
  // Ahora usamos el instituteId como ID del documento para la configuración
  async getFees(instituteId: string): Promise<FeesDoc> {
    try {
      const docRef = doc(db, 'config_fees', instituteId);
      const snap = await getDoc(docRef);

      if (snap.exists()) return snap.data() as FeesDoc;

      // Onboarding: Si no existe config, retornamos defaults (sin guardar aún para no ensuciar DB hasta que guarden)
      const defaultFees: FeesDoc = {};
      ACADEMIC_LEVELS.forEach(l => {
        defaultFees[l] = { tuition: 0, enrolment: 0, test: 0 };
      });
      return defaultFees;
    } catch (e) {
      console.error("Firebase Error (getFees):", e);
      throw e;
    }
  },

  async updateFees(instituteId: string, newFees: FeesDoc): Promise<void> {
    // Guardamos con el ID del tenant
    await setDoc(doc(db, 'config_fees', instituteId), {
      ...newFees,
      instituteId // Redundancia útil para reglas de seguridad
    });
  },

  // --- SCHEDULES ---
  async getSchedules(instituteId: string): Promise<SchedulesDoc> {
    try {
      const docRef = doc(db, 'config_schedules', instituteId);
      const snap = await getDoc(docRef);

      if (snap.exists()) return snap.data() as SchedulesDoc;

      const defaultSchedules: SchedulesDoc = {};
      ACADEMIC_LEVELS.forEach(l => {
        defaultSchedules[l] = "";
      });
      return defaultSchedules;
    } catch (e) {
      console.error("Firebase Error (getSchedules):", e);
      throw e;
    }
  },

  async updateSchedules(instituteId: string, newSchedules: SchedulesDoc): Promise<void> {
    // 1. Guardar la configuración general usando el ID del tenant
    await setDoc(doc(db, 'config_schedules', instituteId), {
      ...newSchedules,
      instituteId
    });

    // 2. Propagar cambios SOLO a los estudiantes de este instituto
    try {
      const studentsRef = collection(db, 'students');
      // IMPORTANTE: Query filtrada por tenant
      const q = query(studentsRef, where("instituteId", "==", instituteId));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      let updateCount = 0;

      snapshot.docs.forEach((docSnap) => {
        const studentData = docSnap.data() as Student;
        const globalScheduleForLevel = newSchedules[studentData.level];

        if (globalScheduleForLevel && globalScheduleForLevel !== studentData.schedule) {
          const studentRef = doc(db, 'students', docSnap.id);
          batch.update(studentRef, { schedule: globalScheduleForLevel });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Updated schedules for ${updateCount} students.`);
      }
    } catch (error) {
      console.error("Error propagating schedule updates:", error);
    }
  },

  // --- STUDENTS ---
  async getStudents(instituteId: string): Promise<Student[]> {
    const colRef = collection(db, 'students');
    // Filtro estricto por Tenant
    const q = query(colRef, where("instituteId", "==", instituteId));

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
  },

  async createStudent(instituteId: string, student: Omit<Student, 'id'>): Promise<string> {
    const colRef = collection(db, 'students');
    // Inyectamos el instituteId al crear
    const docRef = await addDoc(colRef, {
      ...student,
      instituteId
    });
    return docRef.id;
  },

  async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    // Nota: Las reglas de seguridad prevendrán actualizar si no pertenece al tenant
    const docRef = doc(db, 'students', id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { payments, ...studentData } = data as any;
    await updateDoc(docRef, studentData);
  },

  async recordPayment(instituteId: string, id: string, concept: string, amount: number, method: 'CASH' | 'MP' | 'TRANSFER' | 'CARD' = 'CASH', studentName: string): Promise<void> {
    const paymentRecord = {
      paid: true,
      date: new Date().toISOString(),
      amount,
      concept,
      method
    };

    const batch = writeBatch(db);

    // 1. Update Student Record
    const studentRef = doc(db, 'students', id);
    batch.update(studentRef, {
      [`payments.${concept}`]: paymentRecord
    });

    // 2. Create Transaction Record
    const transactionRef = doc(collection(db, 'transactions'));
    const transactionData: Transaction = {
      id: transactionRef.id,
      instituteId,
      date: new Date().toISOString(),
      amount,
      concept,
      studentId: id,
      studentName,
      method,
      type: 'INCOME'
    };
    batch.set(transactionRef, transactionData);

    await batch.commit();
  },

  async getTransactions(instituteId: string): Promise<Transaction[]> {
    const colRef = collection(db, 'transactions');
    const q = query(colRef, where("instituteId", "==", instituteId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Transaction).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async deleteStudent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
  },

  async syncMissingTransactions(instituteId: string): Promise<number> {
    console.log("Iniciando sincronización de transacciones...");
    const students = await this.getStudents(instituteId);
    const existingTransactions = await this.getTransactions(instituteId);

    // Crear un Map para búsqueda rápida de transacciones existentes: "studentId-concept"
    const txMap = new Set(existingTransactions.map(t => `${t.studentId}-${t.concept}`));

    const batch = writeBatch(db);
    let count = 0;

    students.forEach(student => {
      Object.entries(student.payments).forEach(([concept, payment]: [string, any]) => {
        if (payment.paid) {
          const key = `${student.id}-${concept}`;

          if (!txMap.has(key)) {
            // Falta la transacción, la creamos
            const transactionRef = doc(collection(db, 'transactions'));
            const transactionData: Transaction = {
              id: transactionRef.id,
              instituteId,
              date: payment.date || new Date().toISOString(), // Usar fecha del pago o actual
              amount: payment.amount || 0,
              concept: concept,
              studentId: student.id,
              studentName: student.name,
              method: payment.method || 'CASH',
              type: 'INCOME'
            };

            batch.set(transactionRef, transactionData);
            count++;
          }
        }
      });
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Se sincronizaron ${count} transacciones faltantes.`);
    } else {
      console.log("No se encontraron transacciones faltantes.");
    }

    return count;
  }
};