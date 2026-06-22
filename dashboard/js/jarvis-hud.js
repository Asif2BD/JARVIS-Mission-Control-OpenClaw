/**
 * JARVIS HUD — the cinematic layer that ties it together.
 *
 *  - Injects the boot overlay, ambient HUD chrome, voice dock and subtitle.
 *  - Runs the power-up boot sequence (once per browser session).
 *  - Announces Mission Control events through JarvisVoice.
 *  - Parses spoken commands and drives the dashboard.
 *
 * Toggle the whole experience with window.toggleJarvisMode(). The arc-reactor
 * color theme (data-color-theme="jarvis") is independent and set in app.js.
 */
(function () {
  'use strict';

  const V = () => window.JarvisVoice;

  const JarvisHud = {
    booted: false,

    init() {
      this._injectDom();
      if (V()) {
        V().init();
        V().commandHandler = (t) => this.handleCommand(t);
      }
      this._wireSpeechVisuals();
      this._wireDockControls();
      this._wireEventAnnouncements();
      // Boot once per session, only when JARVIS mode is on.
      if (document.documentElement.classList.contains('jarvis-mode')
          && !sessionStorage.getItem('jarvis-booted')) {
        this.boot();
      }
    },

    // ---- DOM ----------------------------------------------------

    _injectDom() {
      if (document.getElementById('jarvis-boot')) return;
      const reactor = '<span class="arc-reactor"><span class="reactor-core"></span></span>';

      const boot = document.createElement('div');
      boot.id = 'jarvis-boot';
      boot.innerHTML =
        `<div>
           <div class="boot-reactor arc-reactor"><span class="reactor-core"></span></div>
           <h1 class="boot-title">JARVIS</h1>
           <div class="boot-log" id="jarvis-boot-log"></div>
           <button class="boot-skip" id="jarvis-boot-skip">SKIP ›</button>
         </div>`;

      const chrome = document.createElement('div');
      chrome.id = 'jarvis-hud-chrome';
      chrome.innerHTML =
        `<div class="hud-grid"></div>
         <div class="hud-scanline"></div>
         <div class="hud-corner tl"></div><div class="hud-corner tr"></div>
         <div class="hud-corner bl"></div><div class="hud-corner br"></div>`;

      const dock = document.createElement('div');
      dock.id = 'jarvis-dock';
      dock.innerHTML =
        `<span class="dock-orb arc-reactor" title="Replay boot sequence">${'<span class="reactor-core"></span>'}</span>
         <div class="dock-wave"><span></span><span></span><span></span><span></span><span></span></div>
         <span class="dock-status" id="jarvis-status">JARVIS online</span>
         <button class="mic" id="jarvis-mic" title="Speak a command">🎙️</button>
         <button class="mute" id="jarvis-mute" title="Mute voice">🔊</button>
         <button class="power" id="jarvis-power" title="Exit JARVIS mode">⏻</button>`;

      const sub = document.createElement('div');
      sub.id = 'jarvis-subtitle';

      const enable = document.createElement('div');
      enable.id = 'jarvis-enable';
      enable.title = 'Enable JARVIS mode';
      enable.innerHTML = `${reactor}<span>ENABLE JARVIS</span>`;
      enable.addEventListener('click', () => this.setMode(true));

      document.body.append(boot, chrome, dock, sub, enable);

      // Hide the mic button entirely where speech recognition is unsupported.
      if (V() && !V().supportsInput()) {
        const mic = document.getElementById('jarvis-mic');
        if (mic) mic.style.display = 'none';
      }
    },

    // ---- Boot sequence ------------------------------------------

    boot(force) {
      if (this.booted && !force) return;
      this.booted = true;
      sessionStorage.setItem('jarvis-booted', '1');
      const overlay = document.getElementById('jarvis-boot');
      const log = document.getElementById('jarvis-boot-log');
      if (!overlay || !log) return;
      log.innerHTML = '';
      overlay.classList.remove('fade-out');
      overlay.classList.add('show');

      const lines = [
        'Initializing JARVIS core…',
        'Loading Mission Control modules…',
        'Establishing real-time uplink…',
        'Calibrating agent telemetry…',
        'Diagnostics: <span class="ok">ALL SYSTEMS NOMINAL</span>',
      ];
      let i = 0;
      const finish = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.classList.remove('show', 'fade-out'), 900);
        if (V()) V().greeting();
        this.setStatus('JARVIS online', false);
      };
      const tick = () => {
        if (i >= lines.length) { setTimeout(finish, 600); return; }
        const div = document.createElement('div');
        div.innerHTML = `<span style="color:var(--jarvis-gold)">›</span> ${lines[i]}`;
        log.appendChild(div);
        i++;
        setTimeout(tick, 480);
      };
      tick();

      const skip = document.getElementById('jarvis-boot-skip');
      if (skip) skip.onclick = () => { i = lines.length; finish(); };
    },

    // ---- Mode toggle --------------------------------------------

    setMode(on) {
      document.documentElement.classList.toggle('jarvis-mode', on);
      localStorage.setItem('jarvis-mode', on ? 'on' : 'off');
      if (on && !sessionStorage.getItem('jarvis-booted')) this.boot();
      // Powering off must be immediate: stop any in-flight speech/listening.
      if (!on) {
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
        if (V() && V().listening) V().stopListening();
      }
    },
    isActive() { return document.documentElement.classList.contains('jarvis-mode'); },
    toggleMode() {
      this.setMode(!document.documentElement.classList.contains('jarvis-mode'));
    },

    // ---- Voice <-> visuals --------------------------------------

    _wireSpeechVisuals() {
      const dock = () => document.getElementById('jarvis-dock');
      window.addEventListener('jarvis:speaking-start', (e) => {
        dock() && dock().classList.add('speaking');
        this.subtitle('JARVIS', e.detail && e.detail.text);
      });
      window.addEventListener('jarvis:speaking-end', () => dock() && dock().classList.remove('speaking'));
      window.addEventListener('jarvis:listening-start', () => {
        dock() && dock().classList.add('listening');
        const mic = document.getElementById('jarvis-mic');
        mic && mic.classList.add('listening');
        this.setStatus('Listening…', true);
      });
      window.addEventListener('jarvis:listening-end', () => {
        dock() && dock().classList.remove('listening');
        const mic = document.getElementById('jarvis-mic');
        mic && mic.classList.remove('listening');
        this.setStatus('JARVIS online', false);
      });
      window.addEventListener('jarvis:heard', (e) => {
        this.subtitle('You', e.detail && e.detail.transcript);
      });
    },

    _wireDockControls() {
      const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
      on('jarvis-mic', () => V() && V().toggleListening());
      on('jarvis-mute', () => {
        const enabled = V() ? V().toggle() : false;
        const btn = document.getElementById('jarvis-mute');
        if (btn) { btn.textContent = enabled ? '🔊' : '🔇'; btn.classList.toggle('off', !enabled); }
      });
      on('jarvis-power', () => this.setMode(false));
      const orb = document.querySelector('#jarvis-dock .dock-orb');
      if (orb) orb.onclick = () => this.boot(true);
      // Reflect persisted mute state on load.
      const mute = document.getElementById('jarvis-mute');
      if (mute && V() && !V().enabled) { mute.textContent = '🔇'; mute.classList.add('off'); }
    },

    // ---- Event announcements ------------------------------------

    _wireEventAnnouncements() {
      const api = window.MissionControlAPI;
      if (!api || typeof api.on !== 'function') return;
      let last = 0;
      const announce = (text, priority) => {
        // Stay silent when JARVIS mode is powered off — the handlers remain
        // registered, so this gate is what makes the power toggle reliable.
        if (!this.isActive()) return;
        const now = Date.now();
        if (now - last < 1200 && !priority) return; // throttle chatter
        last = now;
        if (V()) V().speak(text, { priority });
      };
      // Announce DONE / BLOCKED transitions only once per task (the server emits
      // task.updated for any change, so we de-dupe on id+status).
      const seen = new Set();
      const titleOf = (t) => (t && t.title ? t.title : '');

      api.on('task.created', (t) => announce(`Incoming task. ${titleOf(t) || 'New task logged'}.`));
      api.on('task.updated', (t) => {
        if (!t || !t.id || !t.status) return;
        const key = `${t.id}:${t.status}`;
        if (seen.has(key)) return;
        if (t.status === 'DONE') { seen.add(key); announce(`Task complete, sir. ${titleOf(t)}.`); }
        else if (t.status === 'BLOCKED') { seen.add(key); announce(`Warning. A task is blocked. ${titleOf(t)}.`, true); }
      });
      api.on('review.submitted', () => announce('A task awaits your review, sir.'));
      api.on('review.approved', () => announce('Review approved.'));
      api.on('quota.exceeded', () => announce('Alert. A resource quota has been exceeded.', true));
      api.on('message.created', (m) => { if (m && m.type === 'chat') announce('You have a new message.'); });
      api.on('ws.disconnected', () => this.setStatus('Uplink lost — reconnecting…', false));
      api.on('ws.connected', () => this.setStatus('JARVIS online', false));
      api.on('ws.reconnected', () => { this.setStatus('Uplink restored', false); announce('Uplink restored.'); });
    },

    // ---- Spoken command parser ----------------------------------

    /** Returns true if the transcript matched a command. */
    handleCommand(raw) {
      const t = (raw || '').toLowerCase().trim();
      if (!t) return false;
      const say = (s) => V() && V().speak(s, { priority: true });
      const call = (fn) => { if (typeof window[fn] === 'function') { window[fn](); return true; } return false; };

      // Mute / wake
      if (/\b(mute|silence|quiet|stand down)\b/.test(t)) { V() && V().setEnabled(false); this._reflectMute(); return true; }
      if (/\b(unmute|speak up|wake up|you there|are you there)\b/.test(t)) { V() && V().setEnabled(true); this._reflectMute(); say('At your service, sir.'); return true; }

      // Status report — read live metrics from the header
      if (/\b(status|report|sit ?rep|how are things|summary)\b/.test(t)) { this.speakStatus(); return true; }

      // Theme switching
      if (/\b(matrix)\b/.test(t)) { this._setTheme('matrix'); say('Switching to Matrix protocol.'); return true; }
      if (/\b(jarvis|blue|arc reactor)\b/.test(t) && /\b(theme|mode|protocol|switch)\b/.test(t)) { this._setTheme('jarvis'); say('JARVIS interface engaged.'); return true; }

      // Open panels
      if (/\bchat\b/.test(t)) { say('Opening chat.'); return call('openChatPanel') || call('toggleChatPanel'); }
      if (/\breports?\b/.test(t)) { say('Opening reports.'); return call('openReportsPanel'); }
      if (/\b(schedules?|jobs?|cron)\b/.test(t)) { say('Opening schedules.'); return call('openSchedulesPanel'); }
      if (/\b(events?|activity|feed)\b/.test(t)) { say('Opening the event feed.'); return call('openEventFeedPanel'); }
      if (/\b(github|issues?)\b/.test(t)) { say('Opening GitHub issues.'); return call('openGithubPanel'); }

      // Create a task — "create task <title>" / "new task <title>"
      const m = t.match(/\b(?:create|add|new)\s+(?:a\s+)?task\s+(?:called\s+|named\s+|to\s+)?(.+)$/);
      if (m && m[1]) { this._createTask(m[1].trim()); return true; }

      // Greeting
      if (/\b(hello|hi|hey|good (morning|afternoon|evening))\b/.test(t)) { V() && V().greeting(); return true; }

      say("I'm afraid I didn't catch that, sir.");
      return false;
    },

    speakStatus() {
      const num = (id) => { const el = document.getElementById(id); return el ? (el.textContent || '0').trim() : '0'; };
      const total = num('total-tasks'), prog = num('in-progress'), done = num('completed-today');
      const msg = `Status report. ${total} tasks tracked. ${prog} in progress. ${done} completed today. All systems nominal, sir.`;
      V() && V().speak(msg, { priority: true });
      this.setStatus('Status report', true);
    },

    _createTask(title) {
      const say = (s) => V() && V().speak(s, { priority: true });
      const nice = title.charAt(0).toUpperCase() + title.slice(1);
      const api = window.MissionControlAPI;
      if (api && typeof api.createTask === 'function') {
        api.createTask({ title: nice, status: 'INBOX', priority: 'medium', created_by: 'jarvis-voice' })
          .then(() => { say(`Task created: ${nice}.`); if (typeof window.renderDashboard === 'function') window.renderDashboard(); })
          .catch(() => say('I was unable to create that task, sir.'));
      } else {
        say('Task system is offline, sir.');
      }
    },

    _setTheme(name) {
      if (typeof window.setColorTheme === 'function') window.setColorTheme(name);
      else document.documentElement.setAttribute('data-color-theme', name);
    },
    _reflectMute() {
      const btn = document.getElementById('jarvis-mute');
      if (btn && V()) { btn.textContent = V().enabled ? '🔊' : '🔇'; btn.classList.toggle('off', !V().enabled); }
    },

    // ---- Small helpers ------------------------------------------

    setStatus(text, active) {
      const el = document.getElementById('jarvis-status');
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('active', !!active);
    },
    subtitle(who, text) {
      if (!text) return;
      const el = document.getElementById('jarvis-subtitle');
      if (!el) return;
      el.innerHTML = `<span class="who">${who}</span>${_escape(text)}`;
      el.classList.add('show');
      clearTimeout(this._subTimer);
      this._subTimer = setTimeout(() => el.classList.remove('show'), 4200);
    },
  };

  function _escape(s) {
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  window.JarvisHud = JarvisHud;
  window.toggleJarvisMode = () => JarvisHud.toggleMode();

  // Init after the rest of the app has wired up its API + globals.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => JarvisHud.init());
  } else {
    JarvisHud.init();
  }
})();
