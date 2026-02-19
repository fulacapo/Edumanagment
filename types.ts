
export type Level = 'Kinder' | 'Kids 1' | 'Kids 2' | 'Kids 3' | 'Kids 4' | 'Kids 5' | 'Teens 1' | 'Teens 2' | 'Teens 3' | 'Teens 4' | 'Teens 5' | 'Teens 6' | 'Adults 1' | 'Adults 2' | 'Adults 3' | 'First';

export interface FeeStructure {
  tuition: number;
  enrolment: number;
  test: number;
}

export interface FeesDoc {
  [key: string]: FeeStructure;
}

export interface SchedulesDoc {
  [key: string]: string; // Level -> "Mon & Wed 18:00"
}

export interface PaymentRecord {
  paid: boolean;
  date: string; // ISO String
  amount: number;
  concept: string; // 'March', 'April', 'Test', etc.
  method?: 'CASH' | 'MP' | 'TRANSFER' | 'CARD'; // Updated payment methods
}

export interface Transaction {
  id: string;
  instituteId: string;
  date: string; // ISO String
  amount: number;
  concept: string; // "Matrícula", "Cuota Mar", "Examen"
  studentId: string;
  studentName: string;
  method: 'CASH' | 'MP' | 'TRANSFER' | 'CARD';
  type: 'INCOME' | 'EXPENSE';
}

export interface Student {
  id: string;
  name: string;
  dni: string;
  email?: string;
  phone?: string;
  level: Level;
  address: string;
  schedule?: string; // New field for Course Days/Hours
  notes?: string; // New field for administrative notes
  payments: {
    [key: string]: PaymentRecord;
    // Keys: 'enrolment', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'test'
  };
}

export const ACADEMIC_LEVELS: Level[] = [
  'Kinder', 'Kids 1', 'Kids 2', 'Kids 3', 'Kids 4', 'Kids 5',
  'Teens 1', 'Teens 2', 'Teens 3', 'Teens 4', 'Teens 5', 'Teens 6',
  'Adults 1', 'Adults 2', 'Adults 3', 'First'
];

export const MONTHS_AND_CONCEPTS = [
  'enrolment', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'test'
];