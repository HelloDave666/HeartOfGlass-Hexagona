class AudioRecorder {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.audioStream = null;
    this.mp3Encoder = null;
    this.mp3Data = [];
    this.sampleRate = 44100;
    this.scriptProcessor = null;
    this.sourceNode = null;
  }

  async initialize(audioContext, sourceNode) {
    try {
      console.log('[Recorder] Initialisation...');
      
      if (!window.lamejs) {
        throw new Error('lamejs non chargé. Ajoutez <script src="path/to/lame.min.js"></script>');
      }

      this.audioContext = audioContext;
      this.sourceNode = sourceNode;
      this.sampleRate = audioContext.sampleRate;
      
      console.log('[Recorder] Initialisé');
      return true;
      
    } catch (error) {
      console.error('[Recorder] Erreur initialisation:', error);
      return false;
    }
  }

  startRecording() {
    if (this.isRecording) {
      console.warn('[Recorder] Enregistrement déjà en cours');
      return;
    }

    try {
      console.log('[Recorder] Démarrage enregistrement...');
      
      this.isRecording = true;
      this.mp3Data = [];
      
      this.mp3Encoder = new lamejs.Mp3Encoder(2, this.sampleRate, 128);
      
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 2, 2);
      
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        
        const leftChannel = e.inputBuffer.getChannelData(0);
        const rightChannel = e.inputBuffer.getChannelData(1);
        
        const left = this.convertFloat32ToInt16(leftChannel);
        const right = this.convertFloat32ToInt16(rightChannel);
        
        const mp3buf = this.mp3Encoder.encodeBuffer(left, right);
        if (mp3buf.length > 0) {
          this.mp3Data.push(mp3buf);
        }
      };
      
      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      console.log('[Recorder] Enregistrement démarré');
      
    } catch (error) {
      console.error('[Recorder] Erreur démarrage:', error);
      this.isRecording = false;
      throw error;
    }
  }

  stopRecording() {
    if (!this.isRecording) {
      console.warn('[Recorder] Aucun enregistrement en cours');
      return null;
    }

    try {
      console.log('[Recorder] Arrêt enregistrement...');
      
      this.isRecording = false;
      
      const mp3buf = this.mp3Encoder.flush();
      if (mp3buf.length > 0) {
        this.mp3Data.push(mp3buf);
      }
      
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
      }
      
      const blob = new Blob(this.mp3Data, { type: 'audio/mp3' });
      
      console.log('[Recorder] Enregistrement arrêté. Taille:', blob.size, 'bytes');
      
      this.mp3Data = [];
      this.mp3Encoder = null;
      
      return blob;
      
    } catch (error) {
      console.error('[Recorder] Erreur arrêt:', error);
      this.isRecording = false;
      return null;
    }
  }

  convertFloat32ToInt16(buffer) {
    const l = buffer.length;
    const samples = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return samples;
  }

  downloadRecording(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('[Recorder] Téléchargement lancé');
  }

  dispose() {
    if (this.isRecording) {
      this.stopRecording();
    }
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    this.audioContext = null;
    this.sourceNode = null;
    this.mp3Data = [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioRecorder;
}