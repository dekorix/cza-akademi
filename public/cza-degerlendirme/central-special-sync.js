(function () {
  const STUDENTS_API = '/api/educator-students?page=0';
  const SPECIAL_API = '/api/assessment-special-linked';

  let studentPromise = null;
  let studentCache = [];
  let centralMode = 'checking';
  const bootstrapParams = new URLSearchParams(window.location.search);
  const bootstrapStudentId = String(bootstrapParams.get('studentId') || '').trim();
  const bootstrapProfile = /^SP-[A-Z]+$/.test(String(bootstrapParams.get('profile') || ''))
    ? String(bootstrapParams.get('profile'))
    : '';
  let bootstrapProfileConsumed = false;

  function ensureCentralState() {
    if (!('centralStudentId' in state)) state.centralStudentId = '';
    if (!state.centralStudentId && bootstrapStudentId) state.centralStudentId = bootstrapStudentId;
    if (!('centralStudentName' in state)) state.centralStudentName = '';
    if (!('centralSessionId' in state)) state.centralSessionId = '';
    if (!('centralProfileCode' in state)) state.centralProfileCode = '';
    if (!('centralSyncStatus' in state)) state.centralSyncStatus = 'local-preview';
    if (!('centralLastSyncAt' in state)) state.centralLastSyncAt = '';
  }

  async function loadStudents(force) {
    ensureCentralState();
    if (studentPromise && !force) return studentPromise;
    studentPromise = (async function () {
      try {
        const response = await fetch(STUDENTS_API, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'accept': 'application/json' }
        });
        if (response.status === 401) {
          centralMode = 'auth-required';
          studentCache = [];
          return { mode: centralMode, students: [] };
        }
        if (!response.ok) {
          centralMode = response.status === 404 ? 'preview' : 'unavailable';
          studentCache = [];
          return { mode: centralMode, students: [] };
        }
        const body = await response.json();
        if (!body || body.ok !== true || !Array.isArray(body.students)) {
          centralMode = 'unavailable';
          studentCache = [];
          return { mode: centralMode, students: [] };
        }
        studentCache = body.students.map(function (student) {
          return {
            id: String(student.id || ''),
            name: String(student.name || student.username || 'Öğrenci').trim(),
            code: student.code ? String(student.code) : ''
          };
        }).filter(function (student) { return student.id; });
        centralMode = 'connected';
        return { mode: centralMode, students: studentCache };
      } catch {
        centralMode = 'preview';
        studentCache = [];
        return { mode: centralMode, students: [] };
      }
    })();
    return studentPromise;
  }

  function modeText() {
    if (centralMode === 'connected') return 'Merkezi öğrenci kaydı hazır';
    if (centralMode === 'auth-required') return 'Merkezi kayıt için eğitimci girişi gerekli';
    if (centralMode === 'unavailable') return 'Merkezi kayıt şu anda ulaşılamıyor';
    if (centralMode === 'preview') return 'Yerel önizleme modu · merkezi DB yazımı yok';
    return 'Merkezi bağlantı kontrol ediliyor';
  }

  function selectedStudent() {
    return studentCache.find(function (student) { return student.id === state.centralStudentId; }) || null;
  }

  function studentOptions() {
    const initial = '<option value="">Merkezi öğrenciyi seç</option>';
    return initial + studentCache.map(function (student) {
      const suffix = student.code ? ' · ' + esc(student.code) : '';
      return '<option value="' + esc(student.id) + '" ' +
        (state.centralStudentId === student.id ? 'selected' : '') + '>' +
        esc(student.name + suffix) + '</option>';
    }).join('');
  }

  function applySelectedStudentName(nameInputId) {
    const student = selectedStudent();
    if (!student) return;
    state.centralStudentName = student.name;
    const input = document.getElementById(nameInputId);
    if (input) {
      input.value = student.name;
      input.readOnly = true;
    }
    saveState();
  }

  function connectionMarkup(selectId) {
    if (centralMode === 'connected') {
      return '<div class="central-link-panel connected">' +
        '<div><span>MERKEZİ CZA ÖĞRENCİ KAYDI</span><b>Öğrenciyi merkezi kimliğiyle bağla</b>' +
        '<small>Görev kanıtları assessment_sessions / attempts / observations tablolarına yazılır.</small></div>' +
        '<label>Merkezi öğrenci<select id="' + selectId + '">' + studentOptions() + '</select></label>' +
      '</div>';
    }
    const cls = centralMode === 'auth-required' ? 'blocked' : 'preview';
    return '<div class="central-link-panel ' + cls + '">' +
      '<div><span>MERKEZİ CZA ÖĞRENCİ KAYDI</span><b>' + esc(modeText()) + '</b>' +
      '<small>' + (centralMode === 'preview'
        ? 'Bu ekran statik kabul/önizleme ortamında yerel olarak çalışmaya devam eder.'
        : 'Gerçek öğrenci kanıtı merkezi kayda yazılmadan önce eğitimci oturumu gereklidir.') + '</small></div>' +
    '</div>';
  }

  async function enhanceIntake() {
    if (state.screen !== 'dyslexia-intake' && state.screen !== 'special-generic-intake') return;
    const result = await loadStudents(false);
    if (state.screen !== 'dyslexia-intake' && state.screen !== 'special-generic-intake') return;
    const formPanel = document.querySelector('.form-panel');
    if (!formPanel || formPanel.querySelector('.central-link-panel')) return;

    const wrapper = document.createElement('div');
    const isDyslexia = state.screen === 'dyslexia-intake';
    const selectId = isDyslexia ? 'centralStudentDys' : 'centralStudentGeneric';
    wrapper.innerHTML = connectionMarkup(selectId);
    formPanel.insertBefore(wrapper.firstElementChild, formPanel.firstChild);

    if (result.mode === 'connected') {
      const select = document.getElementById(selectId);
      if (select) {
        select.onchange = function () {
          const previous = state.centralStudentId;
          state.centralStudentId = select.value;
          if (previous !== state.centralStudentId) {
            state.centralSessionId = '';
            state.centralProfileCode = '';
          }
          applySelectedStudentName(isDyslexia ? 'name' : 'sgName');
          saveState();
        };
      }
      if (state.centralStudentId) applySelectedStudentName(isDyslexia ? 'name' : 'sgName');
    }

    wrapStartButton(isDyslexia);
  }

  function intakeError(isDyslexia, message) {
    const error = document.getElementById(isDyslexia ? 'err' : 'sgErr');
    if (error) error.textContent = message;
  }

  function currentProfileCode(isDyslexia) {
    return isDyslexia ? 'SP-DYS' : String(state.specialGenericCode || '');
  }

  async function createCentralSession(isDyslexia) {
    const profileCode = currentProfileCode(isDyslexia);
    if (centralMode !== 'connected') {
      if (centralMode === 'auth-required') throw new Error('educator_session_required');
      return { localPreview: true };
    }
    if (!state.centralStudentId) throw new Error('student_required');

    const payload = {
      action: 'create',
      studentId: state.centralStudentId,
      profileCode,
      grade: isDyslexia
        ? String(document.getElementById('grade')?.value || '')
        : String(document.getElementById('sgGrade')?.value || ''),
      readingStage: isDyslexia
        ? String(document.getElementById('readingStage')?.value || '')
        : '',
      birthDate: isDyslexia
        ? String(document.getElementById('birth')?.value || '')
        : String(document.getElementById('sgBirth')?.value || ''),
      concerns: isDyslexia
        ? String(document.getElementById('concerns')?.value || '')
        : String(document.getElementById('sgConcern')?.value || '')
    };

    const response = await fetch(SPECIAL_API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(function () { return {}; });
    if (!response.ok || body.ok !== true || !body.session) {
      throw new Error(String(body.error || 'central_session_create_failed'));
    }

    state.centralSessionId = String(body.session.id || '');
    state.centralProfileCode = profileCode;
    state.centralSyncStatus = body.resumed ? 'resumed' : 'connected';
    state.centralLastSyncAt = new Date().toISOString();
    if (body.student && body.student.name) {
      state.centralStudentName = String(body.student.name);
    }
    hydrateFromCentral(profileCode, body.attempts || [], body.observations || []);
    saveState();
    return body;
  }

  function wrapStartButton(isDyslexia) {
    const id = isDyslexia ? 'startDys' : 'sgStart';
    const button = document.getElementById(id);
    if (!button || button.dataset.centralWrapped === '1') return;
    const original = button.onclick;
    button.dataset.centralWrapped = '1';
    button.onclick = async function (event) {
      const result = await loadStudents(false);
      if (result.mode === 'auth-required') {
        intakeError(isDyslexia, 'Merkezi kayıt için önce eğitimci oturumu açılmalı.');
        return;
      }
      if (result.mode === 'connected' && !state.centralStudentId) {
        intakeError(isDyslexia, 'Önce merkezi öğrenci kaydını seç.');
        return;
      }
      button.disabled = true;
      try {
        await createCentralSession(isDyslexia);
        if (typeof original === 'function') original.call(button, event);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'central_connection_failed';
        intakeError(isDyslexia,
          code === 'student_not_linked_to_educator'
            ? 'Bu öğrenci eğitimci hesabınıza bağlı değil.'
            : code === 'educator_session_required'
              ? 'Merkezi kayıt için eğitimci girişi gerekli.'
              : 'Merkezi öğrenci kaydı açılamadı: ' + code
        );
      } finally {
        button.disabled = false;
      }
    };
  }

  function evidenceByTask(taskCode) {
    if (!taskCode) return null;
    if (taskCode.indexOf('DYS-PH') === 0) return state.dysEvidence?.[taskCode] || null;
    if (taskCode.indexOf('DYS-LS') === 0) return state.dysLsEvidence?.[taskCode] || null;
    if (taskCode.indexOf('DYS-') === 0) return state.dysAdvancedEvidence?.[taskCode] || null;
    const profileCode = String(state.specialGenericCode || state.centralProfileCode || '');
    return state.specialGenericEvidence?.[profileCode + ':' + taskCode] || null;
  }

  function currentTaskCodeFromDom() {
    const cells = document.querySelectorAll('.micro-stats > div');
    for (let i = cells.length - 1; i >= 0; i -= 1) {
      const label = cells[i].querySelector('span');
      const value = cells[i].querySelector('b');
      if (label && value && label.textContent.trim() === 'Görev') return value.textContent.trim();
    }
    return '';
  }

  function currentTaskMetaFromDom() {
    const heading = document.querySelector('.educator-panel h2');
    const phase = document.querySelector('.phase-chip');
    const area = document.querySelector('.station-header h1');
    return {
      title: heading ? heading.textContent.trim() : '',
      phase: phase ? phase.textContent.trim() : '',
      area: area ? area.textContent.trim() : ''
    };
  }

  function buildAttemptPayload(taskCode, row, meta) {
    const flags = Array.isArray(row?.flags) ? row.flags : [];
    return {
      action: 'attempt',
      sessionId: state.centralSessionId,
      taskCode,
      answerText: String(row?.response || row?.choice || ''),
      choice: row?.choice || null,
      verdict: row?.verdict || 'NO_RESPONSE',
      supportLevel: row?.support || 'NOT_ASSESSED',
      firstMatch: typeof row?.firstMatch === 'boolean' ? row.firstMatch : null,
      flags,
      note: row?.note || '',
      selfCorrected: flags.includes('Kendini düzeltti') || flags.includes('Kendiliğinden düzeltti'),
      responseLatencyMs: row?.latencyMs == null ? null : Number(row.latencyMs),
      totalResponseTimeMs: row?.latencyMs == null ? null : Number(row.latencyMs),
      title: meta.title,
      phase: meta.phase,
      area: meta.area
    };
  }

  async function syncTask(snapshot) {
    if (!snapshot || !state.centralSessionId || centralMode !== 'connected') return;
    try {
      const response = await fetch(SPECIAL_API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok || body.ok !== true) throw new Error(String(body.error || 'sync_failed'));
      state.centralSyncStatus = 'synced';
      state.centralLastSyncAt = new Date().toISOString();
      saveState();
    } catch {
      state.centralSyncStatus = 'sync-error';
      saveState();
    }
  }

  const SAVE_BUTTONS = new Set([
    'dysNext', 'dysSkip',
    'lsNext', 'lsSkip',
    'advNext', 'advSkip',
    'sgNext', 'sgSkip'
  ]);

  document.addEventListener('click', function (event) {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || !SAVE_BUTTONS.has(target.id)) return;
    if (!state.centralSessionId || centralMode !== 'connected') return;

    const taskCode = currentTaskCodeFromDom();
    const row = evidenceByTask(taskCode);
    const meta = currentTaskMetaFromDom();
    if (!taskCode || !row) return;
    const snapshot = buildAttemptPayload(taskCode, { ...row }, meta);
    window.setTimeout(function () { syncTask(snapshot); }, 0);
  }, true);

  function observationFromAttempt(row) {
    const payload = row && row.answer_payload && typeof row.answer_payload === 'object'
      ? row.answer_payload
      : {};
    return {
      taskId: String(row.task_code || ''),
      response: String(row.answer_text || ''),
      choice: payload.choice || '',
      verdict: payload.verdict || '',
      support: payload.supportLevel || '',
      firstMatch: typeof payload.firstMatch === 'boolean' ? payload.firstMatch : null,
      latencyMs: row.response_latency_ms == null ? null : Number(row.response_latency_ms),
      note: payload.note || '',
      flags: Array.isArray(payload.flags) ? payload.flags : []
    };
  }

  function hydrateFromCentral(profileCode, attempts, observations) {
    ensureCentralState();
    if (!Array.isArray(attempts)) return;

    attempts.forEach(function (attempt) {
      const evidence = observationFromAttempt(attempt);
      if (!evidence.taskId) return;
      const observation = Array.isArray(observations)
        ? observations.find(function (item) { return String(item.task_code || '') === evidence.taskId; })
        : null;
      if (observation) {
        if (Array.isArray(observation.observation_codes)) evidence.flags = observation.observation_codes;
        if (observation.educator_note) evidence.note = String(observation.educator_note);
      }

      if (evidence.taskId.indexOf('DYS-PH') === 0) {
        state.dysEvidence = state.dysEvidence || {};
        state.dysEvidence[evidence.taskId] = evidence;
      } else if (evidence.taskId.indexOf('DYS-LS') === 0) {
        state.dysLsEvidence = state.dysLsEvidence || {};
        state.dysLsEvidence[evidence.taskId] = evidence;
      } else if (evidence.taskId.indexOf('DYS-') === 0) {
        state.dysAdvancedEvidence = state.dysAdvancedEvidence || {};
        state.dysAdvancedEvidence[evidence.taskId] = evidence;
      } else {
        state.specialGenericEvidence = state.specialGenericEvidence || {};
        state.specialGenericEvidence[profileCode + ':' + evidence.taskId] = evidence;
      }
    });
    saveState();
  }

  function summaryPayload() {
    const evidenceMaps = [
      state.dysEvidence || {},
      state.dysLsEvidence || {},
      state.dysAdvancedEvidence || {},
      state.specialGenericEvidence || {}
    ];
    let evidenceCount = 0;
    let independentCount = 0;
    let supportedCount = 0;
    evidenceMaps.forEach(function (map) {
      Object.values(map).forEach(function (row) {
        if (!row || typeof row !== 'object') return;
        evidenceCount += 1;
        if (row.support === 'INDEPENDENT') independentCount += 1;
        else if (row.support && row.support !== 'NOT_ASSESSED') supportedCount += 1;
      });
    });
    return {
      profileCode: state.centralProfileCode || state.specialGenericCode || state.specialCode || '',
      evidenceCount,
      independentCount,
      supportedCount,
      clientCompletedAt: new Date().toISOString(),
      diagnosticUse: false,
      source: 'EDUCATOR'
    };
  }

  async function finishCentralSession(button, statusNode) {
    if (!state.centralSessionId || centralMode !== 'connected') return;
    button.disabled = true;
    if (statusNode) statusNode.textContent = 'Merkezi kayıt tamamlanıyor...';
    try {
      const response = await fetch(SPECIAL_API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'finish',
          sessionId: state.centralSessionId,
          summary: summaryPayload()
        })
      });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok || body.ok !== true) throw new Error(String(body.error || 'finish_failed'));
      state.centralSyncStatus = 'completed';
      state.centralLastSyncAt = new Date().toISOString();
      saveState();
      if (statusNode) statusNode.textContent = 'Merkezi öğrenci kaydı tamamlandı.';
      button.textContent = 'Merkezi kayıt tamamlandı ✓';
    } catch (error) {
      if (statusNode) statusNode.textContent = 'Merkezi kayıt tamamlanamadı: ' +
        (error instanceof Error ? error.message : 'finish_failed');
      button.disabled = false;
    }
  }

  function enhanceSummary() {
    const isDysFinal = state.screen === 'dyslexia-final-summary';
    const isGeneric = state.screen === 'special-generic-summary';
    if (!isDysFinal && !isGeneric) return;
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.central-finish-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'central-finish-panel';
    if (state.centralSessionId && centralMode === 'connected') {
      panel.innerHTML =
        '<div><span>MERKEZİ CZA KAYDI</span><b>Bu değerlendirme merkezi öğrenci kimliğine bağlı.</b>' +
        '<small id="centralFinishStatus">Son kanıtları kaydedip oturumu tamamlayabilirsiniz.</small></div>' +
        '<button class="primary-btn" id="centralFinishButton">Merkezi kaydı tamamla</button>';
      hero.appendChild(panel);
      const button = document.getElementById('centralFinishButton');
      const status = document.getElementById('centralFinishStatus');
      if (button) button.onclick = function () { finishCentralSession(button, status); };
    } else {
      panel.innerHTML =
        '<div><span>MERKEZİ CZA KAYDI</span><b>' + esc(modeText()) + '</b>' +
        '<small>Merkezi session olmadan bu sonuç yalnız yerel önizlemede tutulur.</small></div>';
      hero.appendChild(panel);
    }
  }

  function applyBootstrapProfile() {
    if (bootstrapProfileConsumed || !bootstrapProfile || state.screen !== 'home') return;
    const button = document.querySelector('.special-card[data-code="' + bootstrapProfile + '"]');
    if (!button || button.disabled) return;
    bootstrapProfileConsumed = true;
    window.history.replaceState(null, '', window.location.pathname);
    button.click();
  }

  function enhanceConnectionBadge() {
    if (state.screen !== 'home') return;
    const specialHead = document.querySelector('.special-head');
    if (!specialHead || specialHead.querySelector('.central-status-chip')) return;
    const chip = document.createElement('span');
    chip.className = 'central-status-chip';
    chip.textContent = modeText();
    specialHead.appendChild(chip);
  }

  const baseRender = render;
  render = function () {
    ensureCentralState();
    const result = baseRender();
    applyBootstrapProfile();
    loadStudents(false).then(function () {
      enhanceConnectionBadge();
      enhanceIntake();
      enhanceSummary();
    });
    return result;
  };

  ensureCentralState();
  applyBootstrapProfile();
  loadStudents(false).then(function () {
    enhanceConnectionBadge();
    enhanceIntake();
    enhanceSummary();
  });
})();