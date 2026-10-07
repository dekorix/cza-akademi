export type SourceAssessmentStudent = {
  id: string;
  academyId: string;
  name: string;
  birthDate: string | null;
};

export type SourceAssessmentContextDependencies = {
  authenticateStudent(request: Request): Promise<{ student_id: string; academy_id: string } | null>;
  authenticateEducator(request: Request): Promise<{ id: string } | null>;
  findStudent(studentId: string, academyId: string): Promise<SourceAssessmentStudent | null>;
  findLinkedStudent(studentId: string, educatorId: string): Promise<SourceAssessmentStudent | null>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

// This endpoint establishes identity only. It does not replace the original
// task engine, create an assessment, activate a package or create a student.
export function createSourceAssessmentContextHandler(deps: SourceAssessmentContextDependencies) {
  return async function GET(request: Request) {
    const url = new URL(request.url);
    const actor = url.searchParams.get('actor');
    const requestedId = url.searchParams.get('studentId');
    if (actor !== 'student' && actor !== 'educator') {
      return json({ ok: false, error: 'invalid_actor' }, 400);
    }
    try {
      let student: SourceAssessmentStudent | null;
      if (actor === 'student') {
        const identity = await deps.authenticateStudent(request);
        if (!identity) return json({ ok: false, error: 'student_session_required' }, 401);
        if (requestedId && requestedId !== identity.student_id) {
          return json({ ok: false, error: 'student_access_denied' }, 403);
        }
        student = await deps.findStudent(identity.student_id, identity.academy_id);
        // Never trust a resolver result outside the authenticated tenant.
        if (!student || student.id !== identity.student_id || student.academyId !== identity.academy_id) {
          return json({ ok: false, error: 'student_access_denied' }, 403);
        }
      } else {
        const identity = await deps.authenticateEducator(request);
        if (!identity) return json({ ok: false, error: 'educator_session_required' }, 401);
        if (!requestedId || !UUID.test(requestedId)) {
          return json({ ok: false, error: 'invalid_student_id' }, 400);
        }
        student = await deps.findLinkedStudent(requestedId, identity.id);
        if (!student || student.id !== requestedId) {
          return json({ ok: false, error: 'student_not_linked_to_educator' }, 403);
        }
      }
      return json({
        ok: true,
        contractVersion: 1,
        sourceAppId: 'cza-degerlendirme-hl4a5d',
        actor,
        student,
        capabilities: { identityBound: true, originalSessionBridgeReady: false },
      });
    } catch {
      return json({ ok: false, error: 'assessment_identity_unavailable' }, 503);
    }
  };
}
