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
  startsAt: string | null;
  expiresAt: string | null;
  sessionCount: number;
  completedCount: number;
};

export type StudentDashboardActivity = {
  id: string;
  moduleCode: string;
  moduleName: string;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
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
  };
  assignments: StudentDashboardAssignment[];
  recentActivity: StudentDashboardActivity[];
  skillProfile: StudentDashboardSkill[];
};
