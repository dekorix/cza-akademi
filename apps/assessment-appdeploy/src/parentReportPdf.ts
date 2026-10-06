export type ParentPdfArea = {
  id: number;
  title: string;
  status: string;
  academic: string;
  family: string;
  daily: string;
  teacher?: string;
  teacherStructured: string[];
  holistic: string;
  nextStep: string;
  evidence: string;
};

export type ParentPdfRoute = {
  order: number;
  title: string;
  status: string;
  why: string;
  methods: string[];
  rationale: string;
  target: string;
  home: string;
};

export type ParentReportPdfData = {
  student: string;
  isFinal: boolean;
  coverage: string;
  coverageLabel: string;
  attemptCount: number;
  learningResponse: string;
  summary: string[];
  strengths: string[];
  developing: string[];
  priorities: string[];
  strategy: string[];
  teacherNotes: Array<{ title: string; note: string }>;
  areas: ParentPdfArea[];
  routes: ParentPdfRoute[];
  disclaimer: string;
};

export async function downloadParentReportPdf(_data: ParentReportPdfData) {
  window.print();
}
