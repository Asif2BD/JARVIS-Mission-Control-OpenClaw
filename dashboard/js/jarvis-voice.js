/**
 * JARVIS Voice — two-way voice for Mission Control.
 *
 *   Output:  Web Speech API `speechSynthesis` (works in all modern browsers).
 *            Picks a British English voice to match the films; falls back gracefully.
 *   Input:   `SpeechRecognition` / `webkitSpeechRecognition` (Chrome/Edge).
 *            Degrades silently where unsupported — output still works.
 *
 * Emits DOM CustomEvents the HUD listens to:
 *   jarvis:speaking-start / jarvis:speaking-end  (detail: { text })
 *   jarvis:listening-start / jarvis:listening-end
 *   jarvis:heard  (detail: { transcript })
 *   jarvis:command  (detail: { transcript })  — a parsed command was dispatched
 */
(function () {
  'use strict';

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const JarvisVoice = {
    enabled: true,          // text-to-speech on/off (persisted)
    voice: null,            // chosen SpeechSynthesisVoice
    queue: [],
    speaking: false,
    listening: false,
    recognition: null,
    commandHandler: null,   // set by JarvisHud — (transcript) => bool handled

    supportsOutput() { return !!synth; },
    supportsInput() { return !!SpeechRecognition; },

    init() {
      this.enabled = localStorage.getItem('jarvis-voice') !== 'off';
      if (synth) {
        this._loadVoice();
        // Voice list populates async in most browsers.
        if (typeof synth.onvoiceschanged !== 'undefined') {
          synth.onvoiceschanged = () => this._loadVoice();
        }
      }
      if (SpeechRecognition) this._setupRecognition();
      return this;
    },

    _loadVoice() {
      if (!synth) return;
      const voices = synth.getVoices();
      if (!voices || !voices.length) return;
      // Preference order — male British "JARVIS"-like voices first.
      const prefs = [
        'Google UK English Male',
        'Microsoft Ryan Online (Natural) - English (United Kingdom)',
        'Microsoft George - English (United Kingdom)',
        'Daniel',                       // macOS en-GB male
        'Arthur',                       // macOS en-GB
      ];
      for (const name of prefs) {
        const v = voices.find(x => x.name === name);
        if (v) { this.voice = v; return; }
      }
      // Any en-GB, then any English.
      this.voice = voices.find(v => /en[-_]GB/i.test(v.lang))
                || voices.find(v => /^en/i.test(v.lang))
                || voices[0];
    },

    /** Speak text. opts: { priority:true clears the queue first } */
    speak(text, opts = {}) {
      if (!synth || !this.enabled || !text) return;
      if (opts.priority) { synth.cancel(); this.queue = []; }
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = (this.voice && this.voice.lang) || 'en-GB';
      u.rate = 0.98;
      u.pitch = 0.85;   // a touch lower — calm and measured
      u.volume = 1;
      u.onstart = () => {
        this.speaking = true;
        _emit('jarvis:speaking-start', { text });
      };
      u.onend = u.onerror = () => {
        this.speaking = false;
        _emit('jarvis:speaking-end', { text });
      };
      synth.speak(u);
    },

    setEnabled(on) {
      this.enabled = on;
      localStorage.setItem('jarvis-voice', on ? 'on' : 'off');
      if (!on && synth) synth.cancel();
    },
    toggle() { this.setEnabled(!this.enabled); return this.enabled; },

    /** Time-aware greeting like the films. */
    greeting() {
      const h = new Date().getHours();
      const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      this.speak(`${part}, sir. JARVIS online. All systems are operational.`, { priority: true });
    },

    // --- Speech recognition ---------------------------------------

    _setupRecognition() {
      const r = new SpeechRecognition();
      r.lang = 'en-US';
      r.continuous = false;
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        const transcript = (e.results[0][0].transcript || '').trim();
        _emit('jarvis:heard', { transcript });
        if (this.commandHandler) {
          const handled = this.commandHandler(transcript);
          if (handled) _emit('jarvis:command', { transcript });
        }
      };
      r.onerror = () => { /* mic denied / no-speech — fail quiet */ };
      r.onend = () => {
        this.listening = false;
        _emit('jarvis:listening-end', {});
      };
      this.recognition = r;
    },

    startListening() {
      if (!this.recognition || this.listening) return false;
      try {
        this.recognition.start();
        this.listening = true;
        _emit('jarvis:listening-start', {});
        return true;
      } catch (_) { return false; }
    },
    stopListening() {
      if (this.recognition && this.listening) {
        try { this.recognition.stop(); } catch (_) {}
      }
    },
    toggleListening() {
      return this.listening ? (this.stopListening(), false) : this.startListening();
    },
  };

  function _emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  window.JarvisVoice = JarvisVoice;
})();
