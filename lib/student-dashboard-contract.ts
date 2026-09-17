export type StudentDashboardProfile = {
  id: string;
  name: string;
  username: string;
};

export type StudentDashboardAssignment = {
  id: string;
  moduleCode: string;
  moduleName: string;
  title: string;
  instructions: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  sessionCount: number;
  completedCount: number;
  status:
    | 'assigned'
    | 'available'
    | 'in_progress'
    | 'completed'
    | 'expired'
    | 'cancelled'
    | 'closed';
  launchPath: string | null;
  freePracticePath: string | null;
  activeSessionId: string | null;
  lastActivityAt: string | null;
  attemptCount: number;
  correctCount: number;
  expectedCount: number;
  progressPercent: number;
};

export type StudentDashboardActivity = {
  id: string;
  moduleCode: string;
  moduleName: string;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  assignmentId: string | null;
  assignmentTitle: string | null;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
};

export type StudentDashboardSkill = {
  moduleCode: string;
  moduleName: string;
  total: number;
  correct: number;
  accuracy: number;
};

export type StudentDashboardData = {
  profile: StudentDashboardProfile;
  summary: {
    activeAssignments: number;
    completedSessions: number;
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    availableAssignments: number;
    inProgressAssignments: number;
    completedAssignments: number;
  };
  assignments: StudentDashboardAssignment[];
  recentActivity: StudentDashboardActivity[];
  skillProfile: StudentDashboardSkill[];
};
