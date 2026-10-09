(function () {
  const AUTH_API = '/api/educator-auth';
  const SPECIAL_API = '/api/assessment-special-linked';

  let studentPromise = null;
  let centralMode = 'checking';
  const bootstrapParams = new URLSearchParams(window.location.search);
  const bootstrapStudentId = String(bootstrapParams.get('studentId') || '').trim();
  const bootstrapProfile = /^SP-[A-Z]+$/.test(String(bootstrapParams.get('profile') || ''))
    ? String(bootstrapParams.get('profile'))
    : '';
  let bootstrapProfileConsumed = false;

  function ensureCentralState() {
    state.centralStudentId = bootstrapStudentId || '';
    if (!('centralStudentName' in state)) state.centralStudentName = '';
    if (!('centralSessionId' in state)) state.centralSessionId = '';
    if (!('centralProfileCode' in state)) state.centralProfileCode = '';
    if (!('centralSyncStatus' in state)) state.centralSyncStatus = 'local-preview';
    if (!('centralLastSyncAt' in state)) state.centralLastSyncAt = '';
    if (!('centralCandidateId' in state)) state.centralCandidateId = '';
    if (!('centralCycleId' in state)) state.centralCycleId = '';
    if (!('centralCandidateLabel' in state)) state.centralCandidateLabel = '';
  }

  async function loadStudents(force) {
    ensureCentralState();
    if (studentPromise && !force) return studentPromise;
    studentPromise = (async function () {
      try {
        const response = await fetch(AUTH_API, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'me' })
        });
        if (response.status === 401) {
          centralMode = 'auth-required';
          return { mode: centralMode, students: [] };
        }
        if (!response.ok) {
          centralMode = response.status === 404 ? 'preview' : 'unavailable';
          return { mode: centralMode, students: [] };
        }
        const body = await response.json();
        if (!body || body.ok !== true || !body.user) {
          centralMode = 'unavailable';
          return { mode: centralMode, students: [] };
        }
        centralMode = 'connected';
        return { mode: centralMode, students: [] };
      } catch {
        centralMode = 'preview';
        return { mode: centralMode, students: [] };
      }
    })();
    return studentPromise;
  }

  function modeText() {
    if (centralMode === 'connected') return 'Eğitmen oturumu hazır';
    if (centralMode === 'auth-required') return 'Merkezi kayıt için eğitimci girişi gerekli';
    if (centralMode === 'unavailable') return 'Merkezi kayıt şu anda ulaşılamıyor';
    if (centralMode === 'preview') return 'Yerel önizleme modu · merkezi DB yazımı yok';
    return 'Merkezi bağlantı kontrol ediliyor';
  }

  function connectionMarkup() {
    if (centralMode === 'connected') {
      return '<div class="central-link-panel connected">' +
        '<div><span>EĞİTMEN GÖZETİMİNDE DEĞERLENDİRME</span><b>Eğitmen girişi doğrulandı</b>' +
        '<small>Kayıtlı öğrenci hesabı gerekmez. Çocuğun adını aşağıya yazıp değerlendirmeyi başlatın.</small></div>' +
      '</div>';
    }
    const cls = centralMode === 'auth-required' ? 'blocked' : 'preview';
    return '<div class="central-link-panel ' + cls + '">' +
      '<div><span>EĞİTMEN GÖZETİMİNDE DEĞERLENDİRME</span><b>' + esc(modeText()) + '</b>' +
      '<small>' + (centralMode === 'preview'
        ? 'Bu ekran statik kabul/önizleme ortamında yerel olarak çalışmaya devam eder.'
        : 'Gerçek öğrenci kanıtı merkezi kayda yazılmadan önce eğitimci oturumu gereklidir.') + '</small>' +
      '</div>' + (centralMode === 'auth-required'
        ? '<form id="centralEducatorLogin" class="central-educator-login">' +
          '<label>Eğitimci e-postası<input name="email" type="email" autocomplete="username" required></label>' +
          '<label>Parola<input name="password" type="password" autocomplete="current-password" required></label>' +
          '<button class="primary-btn" type="submit">Giriş yap</button>' +
          '<span id="centralLoginError" role="alert" aria-live="polite"></span>' +
          '</form>' : '') +
    '</div>';
  }

  function bindInlineLogin() {
    const form = document.getElementById('centralEducatorLogin');
    if (!form) return;
    form.onsubmit = async function (event) {
      event.preventDefault();
      const button = form.querySelector('button');
      const error = document.getElementById('centralLoginError');
      const email = form.querySelector('[name="email"]').value.trim();
      const passwordInput = form.querySelector('[name="password"]');
      button.disabled = true;
      error.textContent = '';
      try {
        const response = await fetch('/api/educator-auth', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'login', email, password: passwordInput.value }),
          signal: AbortSignal.timeout(30000)
        });
        const body = await response.json().catch(function () { return {}; });
        if (!response.ok || body.ok !== true) {
          const known = ['invalid_credentials', 'rate_limited', 'educator_session_required',
            'request_origin_or_identity_rejected', 'request_origin_rejected', 'auth_unavailable',
            'provider_session_cookie_missing', 'provider_session_cookie_invalid'];
          throw new Error(known.includes(body.error) ? body.error : 'http_' + response.status);
        }
        passwordInput.value = '';
        const auth = await loadStudents(true);
        if (auth.mode !== 'connected') throw new Error('auth_unavailable');
        document.querySelector('.form-panel .central-link-panel')?.remove();
        await enhanceIntake();
      } catch (cause) {
        const code = cause instanceof Error ? cause.message : 'auth_unavailable';
        passwordInput.value = '';
        error.textContent = code === 'invalid_credentials' ? 'E-posta veya parola hatalı.'
          : code === 'rate_limited' ? 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.'
          : code === 'educator_session_required' ? 'Giriş kabul edildi, ancak CZA eğitmen kaydı doğrulanamadı (AUTH-401).'
          : code === 'request_origin_or_identity_rejected' || code === 'request_origin_rejected'
            ? 'Bu önizlemenin güvenli giriş adresi doğrulanamadı (AUTH-403).'
          : code === 'provider_session_cookie_missing' || code === 'provider_session_cookie_invalid'
            ? 'Giriş hizmeti oturum oluşturamadı (AUTH-502).'
          : code === 'TimeoutError' || code === 'AbortError'
            ? 'Giriş yanıtı zaman aşımına uğradı (AUTH-TIMEOUT).'
          : code === 'auth_unavailable' || code === 'http_503'
            ? 'Giriş hizmeti şu anda yanıt vermiyor (AUTH-503).'
          : 'Giriş tamamlanamadı (' + code + ').';
      } finally {
        button.disabled = false;
      }
    };
  }

  async function enhanceIntake() {
    if (state.screen !== 'dyslexia-intake' && state.screen !== 'special-generic-intake') return;
    await loadStudents(false);
    if (state.screen !== 'dyslexia-intake' && state.screen !== 'special-generic-intake') return;
    const formPanel = document.querySelector('.form-panel');
    if (!formPanel || formPanel.querySelector('.central-link-panel')) return;

    const wrapper = document.createElement('div');
    const isDyslexia = state.screen === 'dyslexia-intake';
    wrapper.innerHTML = connectionMarkup();
    formPanel.insertBefore(wrapper.firstElementChild, formPanel.firstChild);
    bindInlineLogin();
    if (centralMode === 'connected' && !bootstrapStudentId) {
      const fresh = document.createElement('button');
      fresh.type = 'button';
      fresh.className = 'secondary-btn';
      fresh.textContent = 'Yeni aday / yeni değerlendirme çevrimi';
      fresh.onclick = function () {
        state.centralCandidateId = '';
        state.centralCycleId = '';
        state.centralCandidateLabel = '';
        state.centralSessionId = '';
        state.centralProfileCode = '';
        state.name = '';
        state.birth = '';
        state.grade = '';
        state.readingStage = '';
        state.concerns = '';
        clearLocalSpecialEvidence();
        saveState();
        render();
      };
      formPanel.insertBefore(fresh, formPanel.firstChild);
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

  function clearLocalSpecialEvidence() {
    state.dysEvidence = {};
    state.dysLsEvidence = {};
    state.dysAdvancedEvidence = {};
    state.specialGenericEvidence = {};
  }

  async function createCentralSession(isDyslexia) {
    const profileCode = currentProfileCode(isDyslexia);
    if (centralMode !== 'connected') {
      if (centralMode === 'auth-required') throw new Error('educator_session_required');
      return { localPreview: true };
    }
    const studentLabel = String(document.getElementById(isDyslexia ? 'name' : 'sgName')?.value || '').trim();
    if (!bootstrapStudentId) {
      // The displayed name may be corrected. Only the explicit new-candidate
      // control rotates the stable candidate and cycle identity.
      state.centralCandidateId = state.centralCandidateId || crypto.randomUUID();
      state.centralCycleId = state.centralCycleId || crypto.randomUUID();
      state.centralCandidateLabel = studentLabel;
      saveState();
    }
    const payload = {
      action: 'create',
      studentId: bootstrapStudentId || undefined,
      studentLabel,
      candidateId: bootstrapStudentId ? undefined : state.centralCandidateId,
      cycleId: bootstrapStudentId ? undefined : state.centralCycleId,
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
    clearLocalSpecialEvidence();
    hydrateFromCentral(profileCode, body.attempts || [], body.observations || []);
    saveState();
    return body;
  }

  function firstIncompleteTaskIndex(taskIds, evidence) {
    return taskIds.findIndex(function (id) {
      const row = evidence[id];
      return !row || !row.verdict || !row.support;
    });
  }

  function resumeCentralTask(isDyslexia) {
    if (isDyslexia) {
      const index = firstIncompleteTaskIndex(dyslexiaTasks.map(function (task) {
        return task.id;
      }), state.dysEvidence || {});
      if (index >= 0) {
        state.dysTaskIndex = index;
        state.screen = 'dyslexia-task';
      } else {
        // All PH tasks are done. Inspect the LS route and every advanced domain
        // from central evidence, not their score/INSUFFICIENT status badges.
        if (typeof window.czaFirstIncompleteDyslexiaLsTaskIndex !== 'function' ||
            typeof window.czaFirstIncompleteDyslexiaAdvancedTask !== 'function') {
          state.screen = 'dyslexia-overview'; // fail safely if a script is absent
        } else {
          const lsIndex = window.czaFirstIncompleteDyslexiaLsTaskIndex();
          if (lsIndex >= 0) {
            state.dysLsTaskIndex = lsIndex;
            state.dysLsDelayRevealed = false;
            state.screen = 'dyslexia-ls-task';
          } else {
            const nextAdvanced = window.czaFirstIncompleteDyslexiaAdvancedTask();
            if (nextAdvanced) {
              state.dysAdvancedDomainId = nextAdvanced.domainId;
              state.dysAdvancedTaskIndex = nextAdvanced.taskIndex;
              state.screen = 'dyslexia-advanced-task';
            } else {
              state.screen = 'dyslexia-final-summary';
            }
          }
        }
      }
    } else {
      const index = window.czaFirstIncompleteGenericTaskIndex?.(state.specialGenericCode,
        state.specialGenericEvidence || {});
      if (!Number.isInteger(index)) {
        state.screen = 'special-generic-intake'; // missing route helper; no false completion
      } else if (index < 0) {
        state.screen = 'special-generic-summary';
      } else {
        state.specialGenericTaskIndex = index;
        state.screen = 'special-generic-task';
      }
    }
    state.taskStartedAt = Date.now();
    saveState();
    render();
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
      if (result.mode === 'connected' && !String(document.getElementById(isDyslexia ? 'name' : 'sgName')?.value || '').trim()) {
        intakeError(isDyslexia, 'Öğrencinin adını yaz.');
        return;
      }
      if (result.mode === 'connected' && isDyslexia && !document.getElementById('grade')?.value) {
        intakeError(isDyslexia, 'Sınıf düzeyini seç.');
        return;
      }
      if (result.mode === 'connected' && isDyslexia && !document.getElementById('readingStage')?.value) {
        intakeError(isDyslexia, 'Okuma aşamasını seç.');
        return;
      }
      button.disabled = true;
      try {
        const central = await createCentralSession(isDyslexia);
        if (typeof original === 'function') original.call(button, event);
        if (central.resumed) resumeCentralTask(isDyslexia);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'central_connection_failed';
        intakeError(isDyslexia,
          code === 'student_not_linked_to_educator'
            ? 'Bu öğrenci eğitimci hesabınıza bağlı değil.'
            : code === 'educator_session_required'
              ? 'Merkezi kayıt için eğitimci girişi gerekli.'
              : 'Değerlendirme kaydı açılamadı: ' + code
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
    if (!snapshot || !state.centralSessionId || centralMode !== 'connected') {
      throw new Error('educator_session_required');
    }
    try {
      const response = await fetch(SPECIAL_API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(30000)
      });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok || body.ok !== true) throw new Error(String(body.error || 'sync_failed'));
      state.centralSyncStatus = 'synced';
      state.centralLastSyncAt = new Date().toISOString();
      saveState();
    } catch (error) {
      state.centralSyncStatus = 'sync-error';
      saveState();
      throw error;
    }
  }

  const SAVE_BUTTONS = new Set([
    'dysNext', 'dysSkip',
    'lsNext', 'lsSkip',
    'advNext', 'advSkip',
    'sgNext', 'sgSkip'
  ]);

  function wrapSaveButtons() {
    SAVE_BUTTONS.forEach(function (id) {
      const button = document.getElementById(id);
      if (!button || button.dataset.centralWrapped === '1') return;
      const original = button.onclick;
      button.dataset.centralWrapped = '1';
      button.onclick = async function (event) {
        if (!state.centralSessionId) {
          if (typeof original === 'function') original.call(button, event);
          return;
        }
        const isSkip = id.endsWith('Skip');
        const taskCode = currentTaskCodeFromDom();
        const row = taskCode ? { ...(evidenceByTask(taskCode) || {}) } : null;
        const needsChoice = Boolean(document.querySelector('[data-letter], [data-adv-choice], [data-sg-choice]'));
        if (!isSkip && (!row?.verdict || !row?.support || (needsChoice && !row?.choice))) {
          if (typeof original === 'function') original.call(button, event);
          return;
        }
        const actions = button.closest('.panel-actions');
        let error = actions?.parentElement?.querySelector('.central-save-error');
        if (!error && actions) {
          error = document.createElement('div');
          error.className = 'central-save-error';
          error.setAttribute('role', 'alert');
          actions.insertAdjacentElement('afterend', error);
        }
        if (error) error.textContent = '';
        if (!taskCode) {
          if (error) error.textContent = 'Görev kimliği okunamadı. Kanıt kaydedilmedi.';
          return;
        }
        if (isSkip) {
          row.verdict = 'NO_RESPONSE';
          row.support = 'NOT_ASSESSED';
        } else {
          const input = document.querySelector('#dysResponse, #lsResponse, #advResponse, #sgResponse');
          if (input) row.response = input.value.trim();
        }
        const note = document.querySelector('#dysNote, #lsNote, #advNote, #sgNote');
        if (note) row.note = note.value;
        button.disabled = true;
        try {
          await syncTask(buildAttemptPayload(taskCode, row, currentTaskMetaFromDom()));
          if (typeof original === 'function') original.call(button, event);
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : 'sync_failed';
          if (error) error.textContent = 'Kanıt merkezi kayda yazılamadı (' +
            (code === 'TimeoutError' ? 'zaman aşımı' : code) + '). Tekrar deneyin.';
        } finally {
          button.disabled = false;
        }
      };
    });
  }

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
      if (statusNode) statusNode.textContent = 'Merkezi değerlendirme kaydı tamamlandı.';
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
        '<div><span>MERKEZİ CZA KAYDI</span><b>Bu değerlendirme eğitmen hesabıyla kaydedildi.</b>' +
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
    wrapSaveButtons();
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
