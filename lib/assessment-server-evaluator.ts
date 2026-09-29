import {
  assessmentRoutingRuleSet,
  assessmentTasks,
  routeAssessmentTask,
} from './assessment-routing';

export type P2ServerVerdict = 'correct' | 'incorrect' | 'unassessable';
export type P2ServerEvaluation = {
  evaluatorId: 'P2_DETERMINISTIC_TEXT';
  evaluatorVersion: '1';
  verdict: P2ServerVerdict;
  needsEducatorReview: boolean;
  supportTriggered: boolean;
  nextTaskCode: string | null;
  responseOrigin: 'server_evaluated' | 'client_reported';
};

export function evaluateP2TextAttempt(
  taskCode: string,
  answerText: string | null,
  responseMode: unknown,
): P2ServerEvaluation {
  const task = assessmentTasks.find((item) => item.id === taskCode);
  if (!task) throw new Error('task_not_found');
  const rules = assessmentRoutingRuleSet();
  const keyed = Object.hasOwn(rules.anchorAnswers, taskCode);
  const text = responseMode === 'TEXT' && typeof answerText === 'string'
    && answerText.trim() !== '' && !answerText.startsWith('[Sözlü cevap');
  const route = routeAssessmentTask(taskCode, text ? answerText : '');
  const verdict: P2ServerVerdict = keyed && text &&
    (route.correctness === 'correct' || route.correctness === 'incorrect')
    ? route.correctness : 'unassessable';
  const adaptive = Object.hasOwn(rules.adaptiveNext, taskCode);
  const needsEducatorReview = verdict === 'unassessable' && adaptive;
  return {
    evaluatorId: 'P2_DETERMINISTIC_TEXT',
    evaluatorVersion: '1',
    verdict,
    needsEducatorReview,
    supportTriggered: verdict === 'incorrect' && adaptive,
    nextTaskCode: needsEducatorReview ? null : route.nextTaskCode,
    responseOrigin: verdict === 'unassessable' ? 'client_reported' : 'server_evaluated',
  };
}
